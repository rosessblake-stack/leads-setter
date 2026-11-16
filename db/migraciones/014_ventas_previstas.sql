-- Venta ya cerrada con alguien que aún no ha rellenado el formulario: cuando llegue su ficha, se registra sola como vendida.
-- Solo añade una tabla.
create table if not exists setter.ventas_previstas (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  producto text not null references setter.ofertas(clave),
  importe_cents integer check (importe_cents is null or importe_cents >= 0),
  forma_pago text check (forma_pago in ('stripe', 'kajabi', 'otra')),
  edicion text check (edicion is null or char_length(edicion) <= 100),
  nota text check (nota is null or char_length(nota) <= 500),
  creado_at timestamptz not null default now(),
  aplicada_at timestamptz
);
create unique index if not exists ventas_previstas_email_uk on setter.ventas_previstas (lower(email)) where aplicada_at is null;
alter table setter.ventas_previstas enable row level security;
create policy app_ventas_previstas on setter.ventas_previstas for all to setter_app using (true) with check (true);
revoke all on setter.ventas_previstas from public, anon, authenticated;
grant select, insert, update, delete on setter.ventas_previstas to setter_app;
