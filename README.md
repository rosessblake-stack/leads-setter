# leads-setter

Setter de leads de Blake. Fase 1: captura y ordena, **no escribe a nadie**.

```
Reel → comentario → ManyChat → /guia?v=CODIGO_VIDEO&mc=ID_CONTACTO
     → formulario → Supabase (schema "setter") → Claude lee las respuestas
     → ficha → aviso por Telegram (solo al admin)
```

## Qué hace hoy

- `/guia`: formulario por pasos (una pregunta por pantalla, barra de progreso, volver, Enter avanza) con cuatro rutas: presencial, online, asesoría 1:1 y "No lo tengo claro". Pensado primero para móvil. Guarda lo respondido en el navegador por si la persona vuelve, y lleva el vídeo de origen (`?v=`) y el contacto de ManyChat (`?mc=`).
- **Las preguntas viven en `src/formulario/preguntas.json`** (textos, opciones, rutas, condiciones, límites). Se editan ahí, sin tocar componentes. Las reglas de sugerencia de oferta de "No lo tengo claro" están en `src/formulario/reglas-oferta.json`. Las opciones marcadas `"__pendiente__"` se muestran como texto libre hasta confirmarlas.
- `POST /api/lead`: valida cada respuesta con ese mismo archivo, guarda persona + formulario + ficha + evento en una transacción y responde. Después Claude rellena la ficha y se avisa por Telegram. Claude solo clasifica con un esquema cerrado; el código valida todo lo que devuelve y los datos de contacto no se le envían.
- El resumen `signals` (urgencia, quién decide, primer pago, ingresos, inversión previa, experiencia, clientes al mes, sugerencia de oferta) lo calcula el código.
- Tope diario de análisis (`MAX_ANALISIS_DIA`).

## Comandos del bot (solo el chat del admin)

- `/estado`: comprueba base de datos, clave de Claude, regalo y fichas sin avisar.
- `/leads`: los últimos 5 leads.
- `/lead N`: la ficha completa del lead número N (1 a 5) de esa lista.
- `/ayuda`: lista de comandos.

El webhook (`/api/telegram`) exige la cabecera secreta `TELEGRAM_WEBHOOK_SECRET` y se registra una vez con `setWebhook` de Telegram.

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
