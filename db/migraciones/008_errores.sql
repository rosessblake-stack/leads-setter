-- Registro de errores del sistema, para verlos en el panel sin depender de los registros de Vercel (solo guardan 1 hora).
-- No se guardan datos personales: los mensajes se limpian (emails y claves largas) y el contexto lleva solo identificadores internos.
create table setter.errores (
  id bigint generated always as identity primary key,
  origen text not null check (char_length(origen) between 1 and 40),
  mensaje text not null check (char_length(mensaje) <= 500),
  contexto jsonb not null default '{}'::jsonb,
  veces integer not null default 1,
  creado_at timestamptz not null default now(),
  ultimo_at timestamptz not null default now(),
  revisado_at timestamptz
);
create index errores_pendientes_idx on setter.errores (ultimo_at desc) where revisado_at is null;
create index errores_ultimo_idx on setter.errores (ultimo_at desc);

alter table setter.errores enable row level security;
create policy app_errores on setter.errores for all to setter_app using (true) with check (true);
revoke all on setter.errores from public, anon, authenticated;
grant select, insert, update, delete on setter.errores to setter_app;
grant usage, select on all sequences in schema setter to setter_app;
