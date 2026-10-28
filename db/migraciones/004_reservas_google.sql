-- Conexión con Google Calendar, enlaces de reserva de un solo lead y reservas confirmadas.

-- Una sola conexión (la cuenta de Blake). El token de refresco se guarda cifrado.
create table setter.google_conexion (
  id boolean primary key default true check (id),
  email text,
  refresh_token_cifrado text not null,
  calendario_id text not null default 'primary',
  conectado_at timestamptz not null default now()
);

-- Control del inicio de sesión con Google (anti-falsificación): se guarda solo la huella.
create table setter.google_estados (
  estado_hash text primary key,
  expira_at timestamptz not null
);

-- Enlace personal de reserva para un lead. Se guarda solo la huella del enlace.
create table setter.enlaces_reserva (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  ficha_id uuid not null references setter.fichas(id) on delete cascade,
  tipo text not null check (tipo in ('venta', 'asesoria')),
  pago_at timestamptz,
  expira_at timestamptz not null,
  creado_at timestamptz not null default now()
);
create index enlaces_reserva_ficha_idx on setter.enlaces_reserva (ficha_id);

create table setter.reservas (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null references setter.fichas(id) on delete cascade,
  enlace_id uuid references setter.enlaces_reserva(id) on delete set null,
  tipo text not null check (tipo in ('venta', 'asesoria')),
  inicio timestamptz not null,
  fin timestamptz not null check (fin > inicio),
  google_event_id text,
  meet_url text,
  estado text not null default 'confirmada' check (estado in ('confirmada', 'cancelada')),
  creado_at timestamptz not null default now()
);
-- Una reserva confirmada por lead y por enlace.
create unique index reservas_ficha_activa_uk on setter.reservas (ficha_id) where estado = 'confirmada';

alter table setter.google_conexion enable row level security;
alter table setter.google_estados enable row level security;
alter table setter.enlaces_reserva enable row level security;
alter table setter.reservas enable row level security;
create policy app_google_conexion on setter.google_conexion for all to setter_app using (true) with check (true);
create policy app_google_estados on setter.google_estados for all to setter_app using (true) with check (true);
create policy app_enlaces_reserva on setter.enlaces_reserva for all to setter_app using (true) with check (true);
create policy app_reservas on setter.reservas for all to setter_app using (true) with check (true);
revoke all on setter.google_conexion, setter.google_estados, setter.enlaces_reserva, setter.reservas from public, anon, authenticated;
grant select, insert, update, delete on setter.google_conexion, setter.google_estados, setter.enlaces_reserva, setter.reservas to setter_app;
