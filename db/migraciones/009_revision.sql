-- Cambios tras la revisión externa: envío atómico de propuestas, reservas sin solapes, límite de peticiones
-- en la base de datos y datos de cada análisis.

-- Propuesta: «enviando» (reclamada por un proceso) e «incierto» (no se sabe si salió; no se reintenta sola).
alter table setter.fichas drop constraint if exists fichas_propuesta_estado_check;
alter table setter.fichas add constraint fichas_propuesta_estado_check
  check (propuesta_estado in ('pendiente', 'enviada', 'no_enviada', 'manual', 'enviando', 'incierto'));

-- Fase nueva: la persona reservó pero no se presentó (distinto de «no vendido»).
alter table setter.fichas drop constraint if exists fichas_fase_check;
alter table setter.fichas add constraint fichas_fase_check
  check (fase in ('nuevo', 'contactado', 'llamada_agendada', 'llamada_hecha', 'no_presento', 'pago_pendiente', 'vendido', 'no_vendido', 'descartado', 'en_pausa'));

-- Reservas: el rango que ocupa una llamada es desde su inicio hasta 1 hora después de acabar.
-- Dos reservas confirmadas no pueden solaparse, así que nunca se reserva dos veces el mismo hueco.
alter table setter.reservas add column if not exists ocupa tstzrange;
update setter.reservas set ocupa = tstzrange(inicio, fin + interval '1 hour') where ocupa is null;
alter table setter.reservas alter column ocupa set not null;
alter table setter.reservas drop constraint if exists reservas_sin_solape;
alter table setter.reservas add constraint reservas_sin_solape exclude using gist (ocupa with &&) where (estado = 'confirmada');

-- Límite de peticiones compartido entre instancias.
create table if not exists setter.limites (
  clave text primary key,
  ventana_hasta timestamptz not null,
  n integer not null
);
alter table setter.limites enable row level security;
drop policy if exists app_limites on setter.limites;
create policy app_limites on setter.limites for all to setter_app using (true) with check (true);
revoke all on setter.limites from public, anon, authenticated;
grant select, insert, update, delete on setter.limites to setter_app;

-- Datos de cada análisis, para poder comparar versiones del prompt y del modelo.
alter table setter.fichas
  add column if not exists prompt_version text,
  add column if not exists tokens_entrada integer,
  add column if not exists tokens_salida integer;

-- Reintento automático del análisis si se cortó (límite de tiempo, reinicio...).
alter table setter.fichas add column if not exists analisis_intentos integer not null default 0;

-- Registro (sin datos personales) de las personas borradas a petición suya, para poder demostrar que se hizo.
create table if not exists setter.borrados (
  id bigint generated always as identity primary key,
  borrado_at timestamptz not null default now(),
  tenia_reserva boolean not null default false,
  evento_calendario_borrado boolean not null default false
);
alter table setter.borrados enable row level security;
drop policy if exists app_borrados on setter.borrados;
create policy app_borrados on setter.borrados for all to setter_app using (true) with check (true);
revoke all on setter.borrados from public, anon, authenticated;
grant select, insert on setter.borrados to setter_app;
grant usage, select on all sequences in schema setter to setter_app;
