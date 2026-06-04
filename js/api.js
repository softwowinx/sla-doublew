// js/api.js
// Cliente Supabase + CRUD sobre 'sla_projects' y 'sla_incidents'.
// Depende de: supabase-js CDN + supabase-config.js
var _db = null;
function _getDb() {
  if (!_db) {
    if (typeof supabase === 'undefined' || typeof SUPABASE_URL === 'undefined' || !SUPABASE_URL) return null;
    _db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  }
  return _db;
}
function isSupabaseConfigured() {
  return typeof supabase !== 'undefined' && typeof SUPABASE_URL !== 'undefined' && !!SUPABASE_URL;
}

// ---- sla_projects ----
function listProjects() {
  var db = _getDb(); if (!db) return Promise.resolve([]);
  return db.from('sla_projects')
    .select('id, sla_code, cliente, plan, total, opportunity_id, updated_at')
    .order('updated_at', { ascending: false })
    .then(function (r) { if (r.error) { console.error('listProjects:', r.error); return []; } return r.data; });
}
function getProject(id) {
  var db = _getDb(); if (!db) return Promise.resolve(null);
  return db.from('sla_projects').select('*').eq('id', id).single()
    .then(function (r) { if (r.error) { console.error('getProject:', r.error); return null; } return r.data; });
}
function createProject(payload) {
  var db = _getDb(); if (!db) return Promise.resolve(null);
  return db.from('sla_projects').insert(payload).select().single()
    .then(function (r) { if (r.error) { console.error('createProject:', r.error); return null; } return r.data; });
}
function updateProject(id, payload) {
  var db = _getDb(); if (!db) return Promise.resolve(null);
  return db.from('sla_projects').update(payload).eq('id', id).select().single()
    .then(function (r) { if (r.error) { console.error('updateProject:', r.error); return null; } return r.data; });
}

// ---- sla_incidents ----
function listIncidents(slaId) {
  var db = _getDb(); if (!db) return Promise.resolve([]);
  return db.from('sla_incidents').select('*').eq('sla_id', slaId)
    .order('created_at', { ascending: true })
    .then(function (r) { if (r.error) { console.error('listIncidents:', r.error); return []; } return r.data; });
}
function createIncident(payload) {
  var db = _getDb(); if (!db) return Promise.resolve(null);
  return db.from('sla_incidents').insert(payload).select().single()
    .then(function (r) { if (r.error) { console.error('createIncident:', r.error); return null; } return r.data; });
}
function updateIncident(id, payload) {
  var db = _getDb(); if (!db) return Promise.resolve(null);
  return db.from('sla_incidents').update(payload).eq('id', id).select().single()
    .then(function (r) { if (r.error) { console.error('updateIncident:', r.error); return null; } return r.data; });
}
function deleteIncident(id) {
  var db = _getDb(); if (!db) return Promise.resolve(false);
  return db.from('sla_incidents').delete().eq('id', id)
    .then(function (r) { if (r.error) { console.error('deleteIncident:', r.error); return false; } return true; });
}
