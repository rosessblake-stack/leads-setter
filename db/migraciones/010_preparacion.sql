-- Formulario de preparación de la asesoría: las preguntas largas, tras el pago, antes de la llamada.
create table if not exists setter.preparaciones (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null unique references setter.fichas(id) on delete cascade,
  token_hash text not null unique,
  respuestas jsonb not null default '{}'::jsonb,
  completada_at timestamptz,
  expira_at timestamptz not null,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
alter table setter.preparaciones enable row level security;
create policy app_preparaciones on setter.preparaciones for all to setter_app using (true) with check (true);
revoke all on setter.preparaciones from public, anon, authenticated;
grant select, insert, update, delete on setter.preparaciones to setter_app;
