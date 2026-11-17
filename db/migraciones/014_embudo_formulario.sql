-- Hasta dónde llega la gente en el formulario y si descarga el regalo (sin datos personales). Solo añade una tabla.
create table if not exists setter.embudo_formulario (
  sesion text not null,
  paso text not null,
  indice integer not null,
  campana text,
  en timestamptz not null default now(),
  primary key (sesion, paso)
);
create index if not exists embudo_formulario_en_idx on setter.embudo_formulario (en desc);
alter table setter.embudo_formulario enable row level security;
create policy app_embudo_formulario on setter.embudo_formulario for all to setter_app using (true) with check (true);
revoke all on setter.embudo_formulario from public, anon, authenticated;
grant select, insert, update, delete on setter.embudo_formulario to setter_app;
