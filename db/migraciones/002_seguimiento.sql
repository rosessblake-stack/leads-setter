-- Seguimiento de cada lead: propuesta enviada, reserva, notas y resultado de la venta.
alter table setter.fichas
  add column if not exists propuesta_estado text not null default 'pendiente'
    check (propuesta_estado in ('pendiente', 'enviada', 'no_enviada', 'manual')),
  add column if not exists propuesta_at timestamptz,
  add column if not exists propuesta_mensaje text,
  add column if not exists reserva_at timestamptz;
create index if not exists fichas_propuesta_idx on setter.fichas (propuesta_estado);
create index if not exists fichas_reserva_idx on setter.fichas (reserva_at);

-- Notas: solo se añaden.
create table setter.notas (
  id bigint generated always as identity primary key,
  ficha_id uuid not null references setter.fichas(id) on delete cascade,
  texto text not null check (char_length(texto) between 1 and 2000),
  creado_at timestamptz not null default now()
);
create index notas_ficha_idx on setter.notas (ficha_id, creado_at desc);

-- Resultado de la venta: uno por lead (se puede corregir).
create table setter.resultados (
  id uuid primary key default gen_random_uuid(),
  ficha_id uuid not null unique references setter.fichas(id) on delete cascade,
  resultado text not null check (resultado in ('vendido', 'no_vendido')),
  producto text references setter.ofertas(clave),
  importe_cents integer check (importe_cents is null or importe_cents >= 0),
  moneda text not null default 'EUR',
  forma_pago text check (forma_pago in ('stripe', 'kajabi', 'otra')),
  edicion text check (edicion is null or char_length(edicion) <= 100),
  motivo text check (motivo in ('precio', 'lo_piensa', 'no_encaja', 'no_responde', 'otro')),
  nota text check (nota is null or char_length(nota) <= 500),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  check ((resultado = 'vendido' and producto is not null) or (resultado = 'no_vendido' and motivo is not null))
);
create trigger resultados_tocar before update on setter.resultados
  for each row execute function setter.tocar_actualizado();

alter table setter.notas enable row level security;
alter table setter.resultados enable row level security;
create policy app_notas on setter.notas for all to setter_app using (true) with check (true);
create policy app_resultados on setter.resultados for all to setter_app using (true) with check (true);
revoke all on setter.notas, setter.resultados from public, anon, authenticated;
grant select, insert on setter.notas to setter_app;
grant select, insert, update, delete on setter.resultados to setter_app;
grant usage, select on all sequences in schema setter to setter_app;
