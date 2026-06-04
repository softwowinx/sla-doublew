# Diseño — Persistencia de proyectos SLA en Supabase (modelo Define-y-Firma)

**Fecha:** 2026-06-04
**Estado:** propuesta para revisión
**Proyecto:** sla-doublew (`contratacion-sla-doublew.html`, `control-seguimiento-sla-doublew.html`)

---

## 1. Contexto y objetivo

Hoy la app SLA **no tiene base de datos**: todo el estado vive en la query-string de la URL + `localStorage`. Un SLA "guardado" es una URL larga; el CRM almacena esa URL en `meta.sla_url` del hito Doc Legal de la oportunidad.

**Objetivo:** persistir los proyectos SLA (contrato completo + incidencias de seguimiento) en una base de datos, de modo que:
- Se puedan **listar, recuperar y editar** proyectos guardados desde un desplegable en la propia app.
- El **seguimiento** lea lo contratado desde BD (no desde la URL) y registre incidencias de forma estructurada.
- Se mantenga el vínculo con el CRM (oportunidad/contacto) y la operativa de acceso actual (referido desde el CRM o por enlace directo, sin login).

## 2. Decisión de topología

**Base de datos Supabase propia y dedicada para el SLA**, replicando el modelo de **Define-y-Firma** (DyF), NO la BBDD del CRM.

- Se descartó alojarlo en la BBDD del CRM (patrón tabla `briefs`) — barajado y descartado por el usuario.
- Coherencia de ecosistema: cada app satélite de documentos (DyF) tiene su propio proyecto Supabase.
- El vínculo con el CRM es **referencia suelta por texto** (no FK entre proyectos distintos): el SLA guarda `opportunity_id`/`contact_id`; el CRM ya guarda `meta.sla_url`.

**Proyecto Supabase a crear:** nombre `sla-doublew`, org `xynjgywjidohnyxseylg` (*softwowinx's Org*, la misma de DyF y el CRM), región `eu-west-2`. Creación vía Management API REST con el PAT (el MCP de Supabase no carga en VSCode).

## 3. Esquema de datos

```sql
-- Cabecera del contrato SLA + estado completo del formulario de contratación
CREATE TABLE sla_projects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_code       text,            -- código legible 'SLA-YYYYMM-XXXX'
  cliente        text NOT NULL DEFAULT '',
  opportunity_id text,            -- ref. suelta a opportunities del CRM (null si entra por enlace)
  contact_id     text,            -- ref. suelta a contacts del CRM
  plan           text,            -- 'daily' | 'semester'
  total          text,            -- importe formateado, para listados sin abrir el JSONB
  state          jsonb NOT NULL,  -- contrato completo serializado (todos los campos del formulario)
  created_by     text,            -- nombre del usuario (sin login real, como DyF)
  updated_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Incidencias del seguimiento (1 sla_project -> N incidencias)
CREATE TABLE sla_incidents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_id        uuid NOT NULL REFERENCES sla_projects(id) ON DELETE CASCADE,
  descripcion   text,
  solucion      text,
  estado        text NOT NULL DEFAULT 'abierta',  -- 'abierta' | 'cerrada'
  clasificacion text,                             -- C1|C2|C3|consulta (modalidad semestral)
  fecha_inicio  timestamptz,
  fecha_fin     timestamptz,
  minutos       integer,                          -- tiempo dedicado cacheado (fin - inicio)
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sla_incidents_sla_id_idx ON sla_incidents (sla_id);

-- Trigger updated_at (ambas tablas), igual que DyF
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER sla_projects_updated_at  BEFORE UPDATE ON sla_projects  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER sla_incidents_updated_at BEFORE UPDATE ON sla_incidents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS allow_all (modelo DyF) en ambas tablas
ALTER TABLE sla_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON sla_projects  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON sla_incidents FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON sla_projects, sla_incidents TO anon, authenticated;
```

## 4. Capa de aplicación (copiada de DyF)

Sin build, JS vanilla, scripts embebidos/añadidos en cada HTML. Nuevos módulos (o bloques inline equivalentes):

- **`supabase-config.js`** — `SUPABASE_URL` + `SUPABASE_ANON` del nuevo proyecto (anon key pública por diseño).
- **`api.js`** — `listProjects()`, `getProject(id)`, `createProject(row)`, `updateProject(id, row)`; y para incidencias `listIncidents(slaId)`, `createIncident(row)`, `updateIncident(id, row)`, `deleteIncident(id)`.
- **`state.js`** — `serializeState()` (formulario → objeto JSONB), `deserializeState(state)` (objeto → formulario), `generateSlaCode()` (`SLA-YYYYMM-XXXX`).
- **Identificación de usuario por nombre** (sessionStorage), estampada en `created_by`/`updated_by` — como DyF. (Sin login real.)
- **Keep-alive** — GitHub Action cron cada ~5 días: `SELECT id LIMIT 1` sobre `sla_projects` para evitar hibernación del plan free. Credenciales en GitHub Secrets.

## 5. Controles de UI (barra superior)

En `contratacion-sla-doublew.html`, barra superior con (réplica de los controles de DyF):
- **Desplegable "Cargar proyecto…"** — lista los SLA guardados (`sla_code — cliente`), al elegir uno carga su `state` en el formulario.
- **Botón "Guardar"** — crea (si es nuevo) o actualiza (si ya tiene `id`) el proyecto en Supabase. Estampa `created_by`/`updated_by`.
- **Botón "Nuevo"** — limpia el formulario y genera un `sla_code` nuevo (arranca un SLA en blanco; resuelve además la deuda pendiente del form que "recordaba" el último contrato).
- Campo `sla_code` (readonly) visible como identificador.

## 6. Operativa de creación y vínculo con el CRM

- **Referido desde el CRM:** el CRM abre el SLA pasando `opportunity_id` (+ datos de prefill de cliente/contacto) por URL, como ya hace hoy. Al guardar, esos valores quedan en la fila.
- **Enlace directo:** se crea un SLA sin oportunidad asociada (`opportunity_id` null).
- **Cardinalidad:** 1 oportunidad → varios SLA (varias filas con el mismo `opportunity_id`; nada lo impide).
- **postMessage `sla_saved` al CRM:** se mantiene. Mejora: la `url` enviada pasa a ser **corta basada en id** (`…/contratacion-sla-doublew.html?id=<uuid>`) en vez de la query-string gigante. El CRM sigue guardándola en `meta.sla_url` sin cambios en su lógica.

## 7. Seguimiento (`control-seguimiento-sla-doublew.html`)

- Carga el SLA por `id` (desde BD), no desde la URL/localStorage. Lo contratado (producto, modelo, días/horas, fechas) se lee de `sla_projects.state` en modo solo lectura.
- Las incidencias dejan de vivir en el jsonb: se listan/crean/editan/borran como filas de `sla_incidents` vía `api.js`. Estado abierta/cerrada, clasificación, tiempo dedicado (auto-calculado `fecha_fin − fecha_inicio`, cacheado en `minutos`).
- El panel de consumo adaptativo (diaria/semestral) se alimenta de las incidencias en BD.

## 8. Compatibilidad y migración

- **Retrocompatibilidad:** los SLA antiguos existen solo como URL larga en `meta.sla_url` del CRM. La app debe seguir aceptando prefill por query-string (no romper enlaces viejos). Un SLA viejo abierto y guardado pasa a tener fila en BD.
- **Sin datos que migrar** en bloque (no hay BD previa); la adopción es incremental al guardar.

## 9. Seguridad

⚠️ **RLS `allow_all` (decisión explícita del usuario, modelo DyF):** cualquiera que tenga la anon key pública (va en el repo estático) puede leer/volcar **todas** las filas de `sla_projects` y `sla_incidents` — contratos e incidencias de todos los clientes. Es el mismo riesgo que DyF ya asume para una herramienta interna. Alternativa descartada (por ahora): endurecer con token no adivinable por SLA en las políticas RLS. Si en el futuro se quiere acotar, se puede migrar a ese modelo sin cambiar la topología.

- La anon key es pública por diseño de Supabase; no se expone service_role en cliente.
- Esta BBDD dedicada **no toca** la del CRM: el núcleo del CRM mantiene su RLS `TO authenticated` intacta.

## 10. Fuera de alcance (YAGNI)

- Login/auth real en la app SLA.
- Sincronización bidireccional automática con el CRM más allá del `postMessage` actual.
- Dashboard analítico de SLA (se puede abordar después, como en DyF fase 5).
- Endurecimiento RLS por token (documentado como evolución futura).

## 11. Entregables

1. Proyecto Supabase `sla-doublew` creado + schema aplicado (secciones 2-3).
2. Capa de app `supabase-config.js` / `api.js` / `state.js` (sección 4).
3. Barra superior con desplegable + Nuevo/Guardar/Cargar en contratación (sección 5).
4. Seguimiento leyendo de BD + incidencias en `sla_incidents` (sección 7).
5. GitHub Action keep-alive (sección 4).
6. postMessage con url corta basada en id (sección 6), sin romper retrocompatibilidad.
