-- Clasificación del contenido (tipo y categoría de cada vídeo) y escalera de regalos por ruta.
-- Los contactos de una persona con tu contenido (comentarios, mensajes, respuestas de motivación...)
-- se guardan en setter.eventos, que ya enlaza persona y vídeo.

-- Tipo: para qué se hizo el vídeo. Categoría: de qué trata.
alter table setter.videos
  add column if not exists tipo text
    check (tipo in ('autoridad', 'proceso', 'conexion', 'vitrina', 'escasez', 'viralidad', 'ensenanza', 'reaccion')),
  add column if not exists categoria text
    check (categoria in ('tecnica', 'estructura', 'formaciones', 'negocio', 'marca_personal', 'mentalidad'));
create index if not exists videos_tipo_idx on setter.videos (tipo, categoria);
create index if not exists eventos_tipo_idx on setter.eventos (tipo, creado_at);

-- Regalos: una escalera por ruta. Orden 1 = lo que recibe al rellenar el formulario;
-- orden 2, 3... = lo que recibe al volver y responder a la pregunta de motivación.
create table setter.regalos (
  id uuid primary key default gen_random_uuid(),
  ruta text not null check (ruta in ('presencial', 'online', 'asesoria', 'no_claro')),
  orden integer not null check (orden >= 1),
  titulo text not null check (char_length(titulo) between 1 and 120),
  url text check (url is null or char_length(url) <= 500),
  activo boolean not null default true,
  creado_at timestamptz not null default now(),
  unique (ruta, orden)
);

-- Qué regalo recibió cada persona, cuándo, y si lo abrió.
create table setter.entregas_regalo (
  id bigint generated always as identity primary key,
  persona_id uuid not null references setter.personas(id) on delete cascade,
  regalo_id uuid not null references setter.regalos(id) on delete restrict,
  video_id uuid references setter.videos(id) on delete set null,
  token text not null unique,
  entregado_at timestamptz not null default now(),
  abierto_at timestamptz,
  unique (persona_id, regalo_id)
);
create index entregas_persona_idx on setter.entregas_regalo (persona_id, entregado_at);

alter table setter.regalos enable row level security;
alter table setter.entregas_regalo enable row level security;
create policy app_regalos on setter.regalos for all to setter_app using (true) with check (true);
create policy app_entregas on setter.entregas_regalo for all to setter_app using (true) with check (true);
revoke all on setter.regalos, setter.entregas_regalo from public, anon, authenticated;
grant select, insert, update, delete on setter.regalos to setter_app;
grant select, insert, update on setter.entregas_regalo to setter_app;
grant usage, select on all sequences in schema setter to setter_app;
