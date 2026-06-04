// js/sla-persist.js
// Persistencia de proyectos SLA en Supabase + barra superior (Cargar / Nuevo / Guardar).
// Depende de: api.js (CRUD), supabase-config.js, y de las funciones globales del formulario
// (value, render, compute, slaTransferData) definidas en el <script> inline de contratación.

(function () {
  'use strict';

  var _currentId = null;        // uuid de la fila en sla_projects (null = sin guardar)
  var _currentCode = null;      // sla_code actual
  var _opportunityId = null;    // ref. suelta al CRM
  var _contactId = null;

  // ---- usuario por nombre (sin login real, como Define-y-Firma) ----
  function currentUser() {
    try {
      var n = sessionStorage.getItem('dw_session_user');
      if (n) return n;
      n = prompt('¿Tu nombre? (para registrar quién guarda este SLA)');
      if (n) { sessionStorage.setItem('dw_session_user', n); return n; }
    } catch (e) {}
    return null;
  }

  // ---- serialización completa del formulario ----
  function serializeSlaState() {
    var state = { fields: {}, radios: {} };
    document.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (el.type === 'radio') { if (el.checked && el.name) state.radios[el.name] = el.value; return; }
      if (!el.id) return;
      if (el.type === 'checkbox') { state.fields[el.id] = el.checked; return; }
      state.fields[el.id] = el.value;
    });
    return state;
  }

  function deserializeSlaState(state) {
    if (!state) return;
    var radios = state.radios || {};
    Object.keys(radios).forEach(function (name) {
      var el = document.querySelector('input[name="' + name + '"][value="' + (radios[name] || '').replace(/"/g, '\\"') + '"]');
      if (el) el.checked = true;
    });
    var f = state.fields || {};
    Object.keys(f).forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      if (el.type === 'checkbox') el.checked = !!f[id];
      else el.value = f[id];
    });
    if (typeof render === 'function') { try { render(); } catch (e) {} }
  }

  function generateSlaCode() {
    var d = new Date();
    var ym = '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0');
    var rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return 'SLA-' + ym + '-' + rnd;
  }

  function setStatus(msg, isError) {
    var s = document.getElementById('slaStatus');
    if (!s) return;
    s.textContent = msg || '';
    s.style.color = isError ? '#fca5a5' : '#86efac';
    if (msg) setTimeout(function () { if (s.textContent === msg) s.textContent = ''; }, 3000);
  }

  function setCode(code) {
    _currentCode = code;
    var el = document.getElementById('slaCode');
    if (el) el.textContent = code || '—';
  }

  function refreshDropdown(selectId) {
    return listProjects().then(function (rows) {
      var sel = document.getElementById('slaLoad');
      if (!sel) return;
      var opts = ['<option value="">— Cargar proyecto guardado —</option>'];
      rows.forEach(function (r) {
        var label = (r.sla_code || r.id.slice(0, 8)) + ' — ' + (r.cliente || 'sin cliente');
        opts.push('<option value="' + r.id + '">' + label.replace(/</g, '&lt;') + '</option>');
      });
      sel.innerHTML = opts.join('');
      if (selectId) sel.value = selectId;
    });
  }

  // ---- acciones ----
  function slaSave() {
    if (!isSupabaseConfigured()) { setStatus('Sin conexión a la base de datos', true); return; }
    var data = (typeof compute === 'function') ? compute() : {};
    if (!_currentCode) setCode(generateSlaCode());
    var user = currentUser();
    var payload = {
      sla_code: _currentCode,
      cliente: (typeof value === 'function' ? value('clientCompany') : '') || '',
      opportunity_id: _opportunityId || null,
      contact_id: _contactId || null,
      plan: data.plan || null,
      total: (typeof EUR !== 'undefined' && data.total != null) ? EUR.format(data.total) : null,
      state: serializeSlaState(),
      updated_by: user || null
    };
    setStatus('Guardando…');
    var p;
    if (_currentId) {
      p = updateProject(_currentId, payload);
    } else {
      payload.created_by = user || null;
      p = createProject(payload);
    }
    p.then(function (row) {
      if (!row) { setStatus('Error al guardar', true); return; }
      _currentId = row.id;
      setCode(row.sla_code);
      // refleja el id en la URL para que un refresh recupere el SLA
      try {
        var u = new URL(window.location.href);
        u.searchParams.set('id', row.id);
        history.replaceState(null, '', u.toString());
      } catch (e) {}
      refreshDropdown(_currentId);
      setStatus('Guardado ✓');
      // notifica al CRM (si estamos en iframe) con la url corta por id
      notifyCrmSaved(row);
    });
  }

  function slaNew() {
    if (!confirm('¿Empezar un SLA nuevo en blanco? Se perderán los datos no guardados.')) return;
    document.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (el.type === 'radio') { el.checked = (el.defaultChecked === true); return; }
      if (el.type === 'checkbox') { el.checked = false; return; }
      if (el.id === 'providerCompany') { el.value = 'The Running of the Bulls, S.L.'; return; }
      if (el.tagName === 'SELECT') { el.selectedIndex = 0; return; }
      el.value = '';
    });
    _currentId = null; _opportunityId = null; _contactId = null;
    setCode(generateSlaCode());
    try { localStorage.removeItem('doublew_sla_contract'); } catch (e) {}
    var sel = document.getElementById('slaLoad'); if (sel) sel.value = '';
    if (typeof render === 'function') { try { render(); } catch (e) {} }
    setStatus('Nuevo SLA');
  }

  function slaLoadSelected() {
    var sel = document.getElementById('slaLoad');
    if (!sel || !sel.value) return;
    var id = sel.value;
    setStatus('Cargando…');
    getProject(id).then(function (row) {
      if (!row) { setStatus('No se pudo cargar', true); return; }
      _currentId = row.id;
      _opportunityId = row.opportunity_id || null;
      _contactId = row.contact_id || null;
      setCode(row.sla_code);
      deserializeSlaState(row.state);
      try {
        var u = new URL(window.location.href);
        u.searchParams.set('id', row.id);
        history.replaceState(null, '', u.toString());
      } catch (e) {}
      setStatus('Cargado ✓');
    });
  }

  // postMessage al CRM con la url corta por id (retrocompatible: el CRM solo lee .url)
  function notifyCrmSaved(row) {
    if (window.parent === window) return; // standalone
    try {
      var shortUrl = window.location.origin + window.location.pathname + '?id=' + row.id;
      window.parent.postMessage({
        type: 'sla_saved',
        url: shortUrl,
        updated_at: row.updated_at || new Date().toISOString(),
        clientCompany: row.cliente || '',
        plan: row.plan || '',
        total: row.total || ''
      }, 'https://softwowinx.github.io');
    } catch (e) { console.error('notifyCrmSaved:', e); }
  }

  // ---- init ----
  function slaInit() {
    var params = new URLSearchParams(window.location.search);
    _opportunityId = params.get('opportunity_id') || params.get('opp') || null;
    _contactId = params.get('contact_id') || null;

    // wiring de botones
    var bSave = document.getElementById('slaSave'); if (bSave) bSave.addEventListener('click', slaSave);
    var bNew = document.getElementById('slaNew'); if (bNew) bNew.addEventListener('click', slaNew);
    var sel = document.getElementById('slaLoad'); if (sel) sel.addEventListener('change', slaLoadSelected);

    // El inline reescribe el enlace a Seguimiento con la query larga en cada render.
    // Lo envolvemos: si ya hay un SLA guardado, el enlace apunta a ?id=<uuid> (carga desde BD).
    if (typeof window.persistSlaTransfer === 'function') {
      var _origPersist = window.persistSlaTransfer;
      window.persistSlaTransfer = function (data) {
        try { _origPersist(data); } catch (e) {}
        if (_currentId) {
          document.querySelectorAll('a[href^="control-seguimiento-sla-doublew.html"]').forEach(function (a) {
            a.href = 'control-seguimiento-sla-doublew.html?id=' + _currentId;
          });
        }
      };
    }

    refreshDropdown();

    var id = params.get('id');
    if (id) {
      // abrir un SLA existente por id (sobrescribe cualquier prefill)
      getProject(id).then(function (row) {
        if (!row) { setStatus('SLA no encontrado', true); return; }
        _currentId = row.id;
        _opportunityId = row.opportunity_id || _opportunityId;
        _contactId = row.contact_id || _contactId;
        setCode(row.sla_code);
        deserializeSlaState(row.state);
        var s = document.getElementById('slaLoad'); if (s) s.value = row.id;
      });
    } else {
      setCode(generateSlaCode());
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', slaInit);
  else slaInit();
})();
