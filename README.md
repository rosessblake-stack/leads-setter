# leads-setter

Setter de leads de Blake. Fase 1: captura y ordena, **no escribe a nadie**.

```
Reel → comentario → ManyChat → /guia?v=CODIGO_VIDEO&mc=ID_CONTACTO
     → formulario → Supabase (schema "setter") → Claude lee las respuestas
     → ficha → aviso por Telegram (solo al admin)
```

## Qué hace hoy

- `/guia`: formulario con consentimiento, campo trampa anti-bots y los identificadores del enlace de ManyChat (`v` = código del vídeo, `mc` = ID del contacto).
- `POST /api/lead`: valida, guarda persona + formulario + ficha + evento en una transacción y responde. Después (sin hacer esperar a la persona) Claude rellena la ficha y se avisa por Telegram.
- Claude solo clasifica con un esquema cerrado; el código valida y recorta todo lo que devuelve. El texto de la persona se trata como dato, nunca como instrucción.
- Tope diario de análisis (`MAX_ANALISIS_DIA`).

## Base de datos

Schema `setter` en el proyecto Supabase `Legacy-Data`. No está expuesto en la API pública: el servidor entra con el rol `setter_app` por conexión directa (`SETTER_DATABASE_URL`). Los eventos solo se añaden.

## Variables de entorno

Ver `.env.example`. Se pegan en Vercel (Settings → Environment Variables), nunca en el chat ni en el repositorio.

## Desarrollo

```
npm install
npm test
npm run typecheck
npm run dev
```

## Pendiente (siguientes fases)

Reglas de llamadas y agenda automática, resumen del closer, conexión de ventas por Stripe, grabación y análisis de llamadas, panel de métricas e Instagram API.
