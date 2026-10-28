-- Clave del temporizador que llama a /api/propuestas/procesar. Se genera aquí y nadie tiene que copiarla.
insert into setter.ajustes (clave, valor)
values ('cron', jsonb_build_object('secreto', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')))
on conflict (clave) do nothing;
