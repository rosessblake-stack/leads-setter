-- Propuesta automática: cuándo se envía, ajustes del sistema y último error de envío.
create table setter.ajustes (
  clave text primary key,
  valor jsonb not null,
  actualizado_at timestamptz not null default now()
);
-- Al principio las propuestas no se envían solas: llegan a Telegram para revisarlas (calibración).
insert into setter.ajustes (clave, valor) values ('propuestas', '{"modo": "calibracion", "restantes": 10}'::jsonb);

alter table setter.fichas
  add column if not exists propuesta_programada_at timestamptz,
  add column if not exists propuesta_error text check (propuesta_error is null or char_length(propuesta_error) <= 300);
create index if not exists fichas_propuesta_prog_idx on setter.fichas (propuesta_programada_at) where propuesta_programada_at is not null;

alter table setter.ajustes enable row level security;
create policy app_ajustes on setter.ajustes for all to setter_app using (true) with check (true);
revoke all on setter.ajustes from public, anon, authenticated;
grant select, insert, update on setter.ajustes to setter_app;
