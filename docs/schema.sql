-- Schema del proyecto Supabase dedicado del SLA (rrcwdlcoxlqemyzrnaln · sla-doublew).
-- Modelo Define-y-Firma: tablas propias, JSONB de estado, RLS allow_all (sin login real).
-- Aplicado el 2026-06-04 vía Management API.

CREATE TABLE IF NOT EXISTS sla_projects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_code       text,
  cliente        text NOT NULL DEFAULT '',
  opportunity_id text,            -- ref. suelta a opportunities del CRM (null si entra por enlace)
  contact_id     text,            -- ref. suelta a contacts del CRM
  plan           text,            -- 'daily' | 'semester'
  total          text,            -- importe formateado, para listados
  state          jsonb NOT NULL DEFAULT '{}',  -- contrato completo: {fields:{id:val}, radios:{name:val}}
  seguimiento_notes text,         -- notas editables del personal de soporte (página de seguimiento)
  created_by     text,
  updated_by     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sla_incidents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_id        uuid NOT NULL REFERENCES sla_projects(id) ON DELETE CASCADE,
  descripcion   text,
  solucion      text,
  estado        text NOT NULL DEFAULT 'abierta',  -- 'abierta' | 'cerrada'
  clasificacion text,                             -- C1|C2|C3|consulta (modalidad semestral)
  fecha_inicio  timestamptz,
  fecha_fin     timestamptz,
  minutos       integer,                          -- tiempo dedicado cacheado (fin - inicio)
  data          jsonb NOT NULL DEFAULT '{}',      -- fila completa de la UI (12 campos + estado), sin pérdida
  created_by    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sla_incidents_sla_id_idx ON sla_incidents (sla_id);
CREATE INDEX IF NOT EXISTS sla_projects_opportunity_id_idx ON sla_projects (opportunity_id);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sla_projects_updated_at ON sla_projects;
CREATE TRIGGER sla_projects_updated_at BEFORE UPDATE ON sla_projects FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS sla_incidents_updated_at ON sla_incidents;
CREATE TRIGGER sla_incidents_updated_at BEFORE UPDATE ON sla_incidents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS allow_all (modelo DyF): cualquiera con la anon key hace CRUD. Riesgo asumido (herramienta interna).
ALTER TABLE sla_projects  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all ON sla_projects;
CREATE POLICY allow_all ON sla_projects  FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS allow_all ON sla_incidents;
CREATE POLICY allow_all ON sla_incidents FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON sla_projects, sla_incidents TO anon, authenticated;
