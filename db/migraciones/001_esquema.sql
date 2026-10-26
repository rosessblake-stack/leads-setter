-- Schema del setter de leads. Aislado de la calculadora (public).
-- No se expone en la Data API; el acceso es solo por el rol setter_app desde el servidor.
create schema if not exists setter;
revoke all on schema setter from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'setter_app') then
    create role setter_app nologin;
  end if;
end $$;

create or replace function setter.tocar_actualizado()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.actualizado_at = now();
  return new;
end $$;

create table setter.personas (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nombre text,
  ig_username text,
  manychat_id text,
  telefono text,
  pais text,
  zona_horaria text,
  consentimiento_at timestamptz,
  consentimiento_texto text,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create unique index personas_email_uk on setter.personas (lower(email));
create unique index personas_manychat_uk on setter.personas (manychat_id) where manychat_id is not null;
create trigger personas_tocar before update on setter.personas
  for each row execute function setter.tocar_actualizado();

create table setter.videos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  ig_media_id text unique,
  enlace text,
  publicado_at timestamptz,
  descripcion text,
  formato text,
  tema text,
  objetivo text check (objetivo in ('alcance', 'venta')),
  palabra_clave text,
  notas text,
  creado_at timestamptz not null default now()
);

create table setter.ofertas (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  requiere_llamada boolean not null default false,
  precio_cents integer check (precio_cents is null or precio_cents >= 0),
  moneda text not null default 'EUR',
  descripcion text,
  activa boolean not null default true,
  creado_at timestamptz not null default now()
);
insert into setter.ofertas (clave, nombre, requiere_llamada, precio_cents, descripcion) values
  ('online', 'Curso online (suscripción anual)', true, 49700, 'Se cierra por llamada. Pago único o 2 cuotas.'),
  ('presencial', 'Formación presencial (1 a 3 días, en España)', true, null, '1.000 € (día 1) / 2.000 € (día 2) / 2.500 € (día 3). Se cierra por chat o llamada posterior; pago dividido en mensualidades antes de la formación.'),
  ('asesoria', 'Asesoría 1:1 online (1 h)', false, 10000, 'Se cierra por chat, con abono completo antes de agendar.');

create table setter.formularios (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references setter.personas(id) on delete cascade,
  video_id uuid references setter.videos(id) on delete set null,
  origen text not null default 'web' check (origen in ('web', 'typeform')),
  interes text check (interes in ('online', 'presencial', 'asesoria', 'no_se')),
  como_nos_conociste text,
  respuestas jsonb not null default '{}'::jsonb,
  regalo_entregado_at timestamptz,
  creado_at timestamptz not null default now(),
  ruta text check (ruta in ('presencial', 'online', 'asesoria', 'no_claro')),
  iniciado_at timestamptz,
  enviado_at timestamptz not null default now(),
  completo boolean not null default true,
  signals jsonb not null default '{}'::jsonb,
  version_formulario text
);
create index formularios_persona_idx on setter.formularios (persona_id);
create index formularios_video_idx on setter.formularios (video_id);

create table setter.fichas (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references setter.personas(id) on delete cascade,
  formulario_id uuid not null unique references setter.formularios(id) on delete cascade,
  nivel text,
  dolores jsonb not null default '[]'::jsonb,
  oferta_recomendada text references setter.ofertas(clave),
  encaje text check (encaje in ('alto', 'medio', 'bajo')),
  resumen text,
  puntuacion integer check (puntuacion is null or puntuacion between 0 and 100),
  modelo text,
  estado text not null default 'nuevo'
    check (estado in ('nuevo', 'analizado', 'notificado', 'con_cita', 'descartado', 'ganado', 'perdido')),
  fase text not null default 'nuevo'
    check (fase in ('nuevo', 'contactado', 'llamada_agendada', 'llamada_hecha', 'pago_pendiente', 'vendido', 'no_vendido', 'descartado', 'en_pausa')),
  notificado_at timestamptz,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index fichas_persona_idx on setter.fichas (persona_id);
create index fichas_estado_idx on setter.fichas (estado);
create index fichas_fase_idx on setter.fichas (fase);
create trigger fichas_tocar before update on setter.fichas
  for each row execute function setter.tocar_actualizado();

create table setter.eventos (
  id bigint generated always as identity primary key,
  persona_id uuid not null references setter.personas(id) on delete cascade,
  video_id uuid references setter.videos(id) on delete set null,
  tipo text not null,
  datos jsonb not null default '{}'::jsonb,
  creado_at timestamptz not null default now()
);
create index eventos_persona_idx on setter.eventos (persona_id, creado_at);
create index eventos_video_idx on setter.eventos (video_id);
create index eventos_tipo_idx on setter.eventos (tipo, creado_at);

create table setter.pagos (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid references setter.personas(id) on delete set null,
  stripe_id text not null unique,
  email_pagador text,
  importe_cents integer not null,
  moneda text not null default 'EUR',
  descripcion text,
  oferta_clave text references setter.ofertas(clave),
  estado text,
  pagado_at timestamptz,
  datos jsonb not null default '{}'::jsonb,
  creado_at timestamptz not null default now()
);
create index pagos_persona_idx on setter.pagos (persona_id);

create table setter.webhooks_procesados (
  id text primary key,
  origen text not null,
  procesado_at timestamptz not null default now()
);

create table setter.panel_tokens (
  token_hash text primary key,
  creado_at timestamptz not null default now(),
  expira_at timestamptz not null,
  usado_at timestamptz
);
create table setter.panel_sesiones (
  sesion_hash text primary key,
  creado_at timestamptz not null default now(),
  expira_at timestamptz not null,
  ultimo_uso_at timestamptz not null default now()
);

-- Seguridad: RLS activado en todo; solo el rol de la app tiene política.
do $$
declare t text;
begin
  foreach t in array array['personas','videos','ofertas','formularios','fichas','eventos','pagos','webhooks_procesados','panel_tokens','panel_sesiones']
  loop
    execute format('alter table setter.%I enable row level security', t);
    execute format('create policy %I on setter.%I for all to setter_app using (true) with check (true)', 'app_' || t, t);
  end loop;
end $$;

revoke all on all tables in schema setter from public, anon, authenticated;
revoke all on all sequences in schema setter from public, anon, authenticated;
revoke all on all functions in schema setter from public, anon, authenticated;

grant usage on schema setter to setter_app;
grant select, insert, update, delete on setter.personas to setter_app;
grant select, insert, update on setter.videos to setter_app;
grant select, update on setter.ofertas to setter_app;
grant select, insert on setter.formularios to setter_app;
grant select, insert, update on setter.fichas to setter_app;
grant select, insert on setter.eventos to setter_app;
grant select, insert, update on setter.pagos to setter_app;
grant select, insert on setter.webhooks_procesados to setter_app;
grant select, insert, update, delete on setter.panel_tokens to setter_app;
grant select, insert, update, delete on setter.panel_sesiones to setter_app;
grant usage, select on all sequences in schema setter to setter_app;
