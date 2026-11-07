-- Comentarios de Instagram: de qué reel viene cada persona. Se usan para enlazar al lead con su reel sin un enlace por vídeo.
-- Solo añade una tabla.
create table if not exists setter.comentarios_ig (
  id bigint generated always as identity primary key,
  ig_comment_id text not null unique,
  ig_media_id text not null,
  ig_user_id text,
  username text,
  texto text check (texto is null or char_length(texto) <= 300),
  comentado_at timestamptz not null,
  creado_at timestamptz not null default now()
);
create index if not exists comentarios_ig_usuario_idx on setter.comentarios_ig (lower(username), comentado_at desc);
create index if not exists comentarios_ig_media_idx on setter.comentarios_ig (ig_media_id);
alter table setter.comentarios_ig enable row level security;
drop policy if exists app_comentarios_ig on setter.comentarios_ig;
create policy app_comentarios_ig on setter.comentarios_ig for all to setter_app using (true) with check (true);
revoke all on setter.comentarios_ig from public, anon, authenticated;
grant select, insert, update, delete on setter.comentarios_ig to setter_app;
grant usage, select on all sequences in schema setter to setter_app;
