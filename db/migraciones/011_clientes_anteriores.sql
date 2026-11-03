-- Clientes anteriores y casos de éxito: personas que ya compraron y rellenan el formulario para conocer mejor su caso.
-- «historico»: no entra en el embudo ni en las estadísticas del mes y no recibe propuesta.
alter table setter.fichas
  add column if not exists origen text not null default 'sistema' check (origen in ('sistema', 'historico')),
  add column if not exists caso_exito boolean not null default false,
  add column if not exists nota_exito text check (nota_exito is null or char_length(nota_exito) <= 1000);
create index if not exists fichas_exito_idx on setter.fichas (caso_exito) where caso_exito;
