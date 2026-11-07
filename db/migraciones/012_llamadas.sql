-- Análisis automático de la llamada de venta: «posible cierre» con fecha y control de qué reservas ya se han leído.
-- Solo añade columnas (no borra nada).
alter table setter.fichas
  add column if not exists cierre_posible_at date,
  add column if not exists cierre_posible_nota text check (cierre_posible_nota is null or char_length(cierre_posible_nota) <= 600);
alter table setter.reservas
  add column if not exists analizada_at timestamptz,
  add column if not exists analisis_intentos integer not null default 0;
