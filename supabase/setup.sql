-- =============================================================================
--  Configuración de seguridad en Supabase
--  Ejecuta esto en el SQL Editor de tu proyecto.
--  NO recrea la tabla `postulantes` ni el bucket `prospecto` (ya existen).
-- =============================================================================

-- 1) Asegurar RLS activo en `postulantes` y SIN policies de select para anon.
--    Toda lectura debe pasar exclusivamente por la Edge Function (service_role,
--    que ignora RLS). Si tuvieras policies de select para anon/authenticated,
--    elimínalas.
alter table postulantes enable row level security;
-- (No crear ninguna policy de select para anon/authenticated.)

-- 2) Tabla para rate limiting / trazabilidad de intentos de acceso.
create table if not exists intentos_login (
  id bigint generated always as identity primary key,
  ip text not null,
  codigo_postulante text,
  exito boolean not null default false,
  creado_en timestamptz not null default now()
);

-- Índice para consultar rápidamente intentos recientes por IP.
create index if not exists idx_intentos_login_ip_fecha
  on intentos_login (ip, creado_en desc);

-- RLS activo y sin acceso desde el cliente: sólo la Edge Function (service_role)
-- puede leer/escribir aquí.
alter table intentos_login enable row level security;

-- 3) Verifica que el bucket `prospecto` sea PRIVADO (no público).
--    Un bucket público anularía toda la seguridad. Ajústalo si hiciera falta:
-- update storage.buckets set public = false where id = 'prospecto';
