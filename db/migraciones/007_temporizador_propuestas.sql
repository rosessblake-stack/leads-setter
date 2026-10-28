-- Temporizador (solo en Supabase; en local no hace falta): cada 5 minutos pide a la web que procese las propuestas pendientes.
-- Usa la clave 'cron' de setter.ajustes (creada en 006). Requiere las extensiones pg_net y pg_cron.
-- create extension if not exists pg_net with schema extensions;
-- create extension if not exists pg_cron;
-- select cron.schedule('setter-propuestas', '*/5 * * * *', $$select net.http_post(
--     url := 'https://leads-setter.vercel.app/api/propuestas/procesar',
--     headers := jsonb_build_object('content-type', 'application/json',
--                                   'x-cron-secret', (select valor ->> 'secreto' from setter.ajustes where clave = 'cron')),
--     body := '{}'::jsonb, timeout_milliseconds := 30000)$$);
select 1;
