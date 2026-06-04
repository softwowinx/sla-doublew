// js/sla-seguimiento.js
// Conecta la página de seguimiento con Supabase:
//   - Carga "Lo contratado" + cliente/contacto desde sla_projects (por ?id=).
//   - Persiste las incidencias en sla_incidents (alta/edición/baja, debounced).
//   - Persiste las notas de contacto en sla_projects.seguimiento_notes.
// Depende de: api.js + supabase-config.js + funciones globales del inline (el, addRow, render,
// rows, hmToMinutes, minutesToHM). Solo actúa si la URL trae ?id=<uuid de sla_projects>.

(function () {
  'use strict';

  var _slaId = null;
  var _syncTimer = null, _syncing = false, _syncPending = false;
  var _notesTimer = null;

  function user() {
    try { return sessionStorage.getItem('dw_session_user') || null; } catch (e) { return null; }
  }

  // ---- contrato ----
  function fillContract(row) {
    var st = row.state || {};
    var f = st.fields || {};
    var plan = (st.radios && st.radios.plan) || row.plan || 'daily';
    ['clientCompany', 'finalClient', 'clientContact', 'clientRole', 'clientEmail', 'clientPhone',
     'product', 'startDate', 'endDate'].forEach(function (id) {
      if (el(id) != null && f[id] != null) el(id).value = f[id];
    });
    if (el('model')) el('model').value = (plan === 'daily')
      ? 'SLA DOUBLEW - modalidad diaria' : 'SLA DOUBLEW - modalidad semestral';

    var wd = parseInt(f.activationDays || '0', 10) || 0;
    var hd = parseInt(f.holidayDays || '0', 10) || 0;
    var packs = parseInt(f.hourPacks || '0', 10) || 0;
    var slaH = (plan === 'semester') ? (packs * 10) : 0;

    if (el('slaHours')) el('slaHours').value = slaH || '';
    if (el('daysContracted')) {
      if (wd || hd) {
        var dp = [];
        if (wd) dp.push(wd + ' laborable' + (wd !== 1 ? 's' : ''));
        if (hd) dp.push(hd + ' festivo/fin de semana');
        el('daysContracted').value = (wd + hd) + ' día' + ((wd + hd) !== 1 ? 's' : '') + ' (' + dp.join(' + ') + ')';
      } else el('daysContracted').value = '—';
    }
    if (el('hoursContracted')) {
      el('hoursContracted').value = slaH > 0
        ? (slaH + ' h' + (packs ? ' (' + packs + ' paquete' + (packs !== 1 ? 's' : '') + ' × 10 h)' : ''))
        : '—';
    }
    if (el('contactNotes') && row.seguimiento_notes != null) el('contactNotes').value = row.seguimiento_notes;
  }

  // ---- incidencias ----
  function combineDateTime(date, time) {
    if (!date) return null;
    return date + 'T' + (time && /^\d{2}:\d{2}/.test(time) ? time : '00:00') + ':00';
  }

  function rowToPayload(tr) {
    var c = tr.querySelectorAll('input, select, textarea');
    var data = {
      date: c[0].value, time: c[1].value, medium: c[2].value, description: c[3].value,
      urgency: c[4].value, type: c[5].value, openedBy: c[6].value, start: c[7].value,
      closedBy: c[8].value, end: c[9].value, spent: c[10].value, solution: c[11].value,
      state: tr.classList.contains('closed') ? 'Cerrada' : 'Abierta'
    };
    return {
      sla_id: _slaId,
      descripcion: data.description || null,
      solucion: data.solution || null,
      estado: tr.classList.contains('closed') ? 'cerrada' : 'abierta',
      clasificacion: data.type || null,
      fecha_inicio: combineDateTime(data.date, data.start),
      fecha_fin: combineDateTime(data.date, data.end),
      minutos: hmToMinutes(data.spent) || null,
      data: data,
      created_by: user()
    };
  }

  function scheduleSync() {
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(syncIncidents, 700);
  }

  function syncIncidents() {
    if (!_slaId) return;
    if (_syncing) { _syncPending = true; return; }
    _syncing = true;
    var trs = Array.from(el('incTable').querySelectorAll('tbody tr'));
    var chain = Promise.resolve();
    trs.forEach(function (tr) {
      chain = chain.then(function () {
        var payload = rowToPayload(tr);
        if (tr.dataset.incidentId) return updateIncident(tr.dataset.incidentId, payload);
        return createIncident(payload).then(function (row) { if (row) tr.dataset.incidentId = row.id; });
      });
    });
    chain.then(function () {
      _syncing = false;
      if (_syncPending) { _syncPending = false; scheduleSync(); }
    }).catch(function (e) { console.error('syncIncidents:', e); _syncing = false; });
  }

  function loadIncidents() {
    return listIncidents(_slaId).then(function (list) {
      var tb = el('incTable').querySelector('tbody');
      tb.innerHTML = '';
      list.forEach(function (row) {
        var d = row.data && Object.keys(row.data).length ? row.data : {
          description: row.descripcion || '', solution: row.solucion || ''
        };
        addRow(d, true);
        var tr = tb.lastElementChild;
        tr.dataset.incidentId = row.id;
        if ((row.estado === 'cerrada') || (d.state === 'Cerrada')) tr.classList.add('closed');
      });
      if (typeof render === 'function') render();
    });
  }

  function saveNotes() {
    if (!_slaId || !el('contactNotes')) return;
    clearTimeout(_notesTimer);
    var val = el('contactNotes').value;
    _notesTimer = setTimeout(function () {
      updateProject(_slaId, { seguimiento_notes: val });
    }, 800);
  }

  function wire() {
    var table = el('incTable');
    // ediciones de incidencias -> sync debounced (tras el render del inline que recalcula "spent")
    table.addEventListener('input', scheduleSync);
    table.addEventListener('change', scheduleSync);
    // alta, cambio de estado y borrado
    table.addEventListener('click', function (e) {
      if (e.target.closest('.state-btn')) { scheduleSync(); return; }
      var yes = e.target.closest('.del-yes');
      if (yes) {
        var tr = yes.closest('tr');
        if (tr && tr.dataset.incidentId) deleteIncident(tr.dataset.incidentId);
      }
    });
    // botón "Añadir incidencia": el inline crea la fila; aquí la registramos en BD
    var addBtn = el('addRow');
    if (addBtn) addBtn.addEventListener('click', function () { scheduleSync(); });
    // notas de contacto
    if (el('contactNotes')) el('contactNotes').addEventListener('input', saveNotes);
  }

  function init() {
    if (!isSupabaseConfigured()) return;
    var id = new URLSearchParams(location.search).get('id');
    if (!id) return; // sin id: comportamiento demo del inline (localStorage/URL)
    _slaId = id;
    wire();
    // el enlace "Contratación" de la cabecera debe reabrir ESTE mismo SLA
    document.querySelectorAll('a[href^="contratacion-sla-doublew.html"]').forEach(function (a) {
      a.href = 'contratacion-sla-doublew.html?id=' + _slaId;
    });

    getProject(id).then(function (row) {
      if (!row) { console.warn('SLA no encontrado:', id); return; }
      fillContract(row);
      return loadIncidents();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
