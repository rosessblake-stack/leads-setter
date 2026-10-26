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
- La pantalla final cambia según la ruta y usa el nombre y el canal que eligió la persona (`final` en `preguntas.json`, con `{nombre}` y `{canal}`).
- `POST /api/lead`: valida cada respuesta con ese mismo archivo, guarda persona + formulario + ficha + evento en una transacción y responde. Después Claude rellena la ficha y se avisa por Telegram. Claude solo clasifica con un esquema cerrado; el código valida todo lo que devuelve y los datos de contacto no se le envían.
- El resumen `signals` (urgencia, quién decide, primer pago, ingresos, inversión previa, experiencia, clientes al mes, sugerencia de oferta) lo calcula el código.
- Tope diario de análisis (`MAX_ANALISIS_DIA`).

## Política de privacidad

`/privacidad` (texto en `src/formulario/privacidad.ts`). Es un **borrador**: los huecos `[PENDIENTE: ...]` (empresa y número fiscal, dirección, email de contacto y plazo de conservación) se rellenan antes de abrir el formulario al público, y conviene revisarla con un gestor o abogado. Las tipografías se sirven desde la propia web, sin pedir nada a Google.

## Comandos del bot (solo el chat del admin)

- `/estado`: comprueba base de datos, clave de Claude, regalo y fichas sin avisar.
- `/leads`: los últimos 5 leads.
- `/lead N`: la ficha completa del lead número N (1 a 5) de esa lista.
- `/panel`: enlace de un solo uso (10 minutos) para entrar al panel privado.
- `/cerrar_panel`: cierra todas las sesiones del panel y anula los enlaces pendientes.
- `/ayuda`: lista de comandos.

## Panel privado

`/panel` (lista de leads con filtros) y `/panel/lead/<id>` (ficha). Acceso: el enlace de `/panel` no gasta el acceso al abrirse, solo al pulsar el botón (así las vistas previas de Telegram no lo consumen); crea una sesión de 7 días en una cookie httpOnly limitada a `/panel`. En la base de datos solo se guardan huellas (hash) de enlaces y sesiones. Cada acceso avisa por Telegram.

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
