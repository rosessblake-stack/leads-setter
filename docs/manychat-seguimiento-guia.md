# Seguimiento de la guía en ManyChat

Flujo «Seguimiento guía»: lo lanza el sistema 18 horas después de que alguien descargue la guía. Cada respuesta se guarda como nota en su ficha.

## Antes de empezar
1. Vercel: variable `MANYCHAT_WEBHOOK_SECRET` (clave del generador de Ajustes, 30+ caracteres, Sensitive) y Redeploy.
2. ManyChat: campos de texto para las respuestas libres (por ejemplo `guia_opinion`, `guia_aprendido`, `guia_problema`; el nombre es libre, mi sistema solo recibe su valor por la dirección). `propuesta_enlace` ya existe y ese sí tiene que llamarse así.
3. Cada petición externa: método GET, sin cuerpo, cabecera `x-manychat-secret` con la clave.
4. Base de todas las direcciones: `https://leads-setter.vercel.app/api/manychat/respuesta`
5. Variable del ID del contacto: la misma que va en el enlace del formulario (`mc=`). Insertar siempre las variables con el botón `{ }`.

## Flujo
Disparador: mensaje directo con palabra clave exacta `zzsegguia7qx`. Nombre del flujo: «Seguimiento guía». Publicarlo.

N1 Mensaje con botones: «Hola {nombre}, soy Blake 🙌 ¿Pudiste abrir y leer la guía?» [Sí, la leí] [No pude abrirla]

### Ruta A: Sí, la leí
- A1 Petición: `?mc={{ID}}&leyo=Si`
- A2 Recolección → `guia_opinion`: «Me alegra. ¿Qué te ha parecido?»
- A3 Recolección → `guia_aprendio`: «¿Qué es lo que más te ha servido o lo que más has aprendido?»
- A4 Petición: `?mc={{ID}}&opinion={{guia_opinion}}&aprendio={{guia_aprendio}}`
- A5 Mensaje con botones: «Gracias por contármelo. ¿Te gustaría trabajar todo esto más a fondo en tu negocio, en una asesoría de 1 hora conmigo?» [Sí, me interesa] [Ahora no]
  - Sí: A6 Petición `?mc={{ID}}&asesoria=Si`; A7 mensaje con botón de enlace `{{propuesta_enlace}}`.
  - No: A8 Petición `?mc={{ID}}&asesoria=No`; A9 «Sin problema. Si más adelante te encaja, aquí estoy 💛».

### Ruta B: No pude abrirla
- B1 Petición: `?mc={{ID}}&leyo=No`
- B2 Mensaje con botón de enlace a `https://leads-setter.vercel.app/guia-cobrar-y-datos.pdf`
- B3 Recolección → `guia_problema`: «¿Qué te pasó al abrirla? Cuéntamelo y lo arreglo.»
- B4 Petición: `?mc={{ID}}&problema={{guia_problema}}`
- B5 «Gracias por avisarme 🙏 Lo reviso.»

## Respuestas de la petición
200 `{"ok":true}`; 404 `contacto_desconocido` (la clave y el formato están bien, falta ficha); 401 con motivo (`falta_la_cabecera_x-manychat-secret`, `clave_incorrecta`, `servidor_sin_clave_valida`); 400 con `mc`, `texto_vacio`, `paso` o `json`.

## Dos pasos nuevos en el flujo «Seguimiento guía»

### 1. Respuesta personal entre «qué aprendiste» y la pregunta de la asesoría

1. En ManyChat crea un **campo de usuario** de tipo texto llamado `guia_respuesta` (Ajustes → Campos). Si prefieres otro nombre, avísame o pon la variable `MANYCHAT_CAMPO_RESPUESTA` en Vercel.
2. La petición externa que ya envía `opinion` y `aprendio` (`…/api/manychat/respuesta?mc={{user_id}}&opinion={{…}}&aprendio={{…}}`) ahora, además de guardarlas, **escribe en `guia_respuesta`** un mensaje corto y personal: agradece lo que contó, lo comenta con sus palabras y menciona los temas que marcó en el formulario. Tarda unos segundos.
3. Justo **después de esa petición y antes de «¿Quieres trabajarlo en una asesoría?»**, añade un mensaje de Instagram cuyo texto sea solo la variable `{{guia_respuesta}}` (insértala con el botón de variables).
4. Si algo falla (Claude no responde, el texto no es aceptable), el campo se rellena con un agradecimiento genérico y el flujo sigue igual.

### 2. «¿Por qué no?» para quien dice que no

1. En la rama **No** de la pregunta de la asesoría, después de la petición `asesoria=No`, añade un mensaje que pregunte, por ejemplo: «Gracias por decírmelo. ¿Me cuentas por qué? Quizá todavía no es el momento o no lo necesitas ahora mismo» y espera su respuesta de texto (guárdala en un campo, por ejemplo `guia_motivo`).
2. Después añade una petición externa: `…/api/manychat/respuesta?mc={{user_id}}&motivo={{cuf_…}}` (con el campo insertado como variable) y la misma cabecera `x-manychat-secret`.
3. El motivo queda como nota de la ficha («Por qué no quiere la asesoría: …»), se añade a la nota de «No vendido» y te llega un aviso a Telegram.

## Una sola pregunta: «¿qué te ha parecido y qué has aprendido?»

Para quitar fricción, las dos preguntas (opinión y aprendizaje) pueden ser **una sola**. Nuevo orden del flujo «Seguimiento guía»:

1. «¿Pudiste abrir y leer la guía?» → Sí / No (igual que ahora).
2. **Sí →** un único mensaje, por ejemplo: «¿Qué te ha parecido la guía y qué has aprendido con ella?», con «Esperando texto». Guarda la respuesta en un campo de usuario (por ejemplo `guia_valoracion`).
3. Petición externa: `https://leads-setter.vercel.app/api/manychat/respuesta?mc={{user_id}}&valoracion={{guia_valoracion}}` (misma cabecera `x-manychat-secret`). Guarda la respuesta como una sola nota y prepara la respuesta personal en `guia_respuesta`.
4. Mensaje con `{{guia_respuesta}}` → pregunta de la asesoría (Sí / No), igual que ahora.

Las peticiones antiguas (`opinion` + `aprendio`) siguen funcionando mientras no cambies el flujo.

## Visor de la guía y botón «Cuéntame qué te ha parecido»

La pantalla final del formulario ofrece **«Leer la guía ahora»** (visor web con las 23 diapositivas, `/guia/leer`) y, debajo, la descarga del PDF. El visor mide qué diapositivas ve cada persona y cuánto tiempo (se ve en su ficha y en el panel «Embudo»). Al final tiene el botón **«Cuéntame qué te ha parecido»**, que abre tu chat de Instagram (`https://ig.me/m/blakebraider?ref=opinion_guias`, o el enlace que pongas en la variable `GUIA_URL_CHAT` de Vercel).

Para que quien lo pulse reciba al instante la pregunta, en ManyChat:

1. Crea un disparador para ese enlace. Lo mejor es una herramienta de crecimiento **«Instagram Ref URL»** (te da un enlace del tipo `https://ig.me/m/blakebraider?ref=…`). Si no la tienes, sirve una palabra clave que la persona escriba.
2. El flujo que arranca empieza directamente en «¿Qué te ha parecido la guía y qué has aprendido con ella?» y sigue igual que la rama del Sí del «Seguimiento guía» (petición `valoracion=`, mensaje `{{guia_respuesta}}`, pregunta de la asesoría).
3. Pásame el enlace `ref` y lo pongo en el botón del visor.

Quien ya ha empezado a responder así no recibe después el lanzamiento automático del seguimiento (a las 18 h). El seguimiento de las 18 h cuenta desde que la persona descarga el PDF **o abre el visor**, lo primero que ocurra.

## Que quien pulse «Cuéntame qué te ha parecido» reciba la pregunta (sin que se cuele cualquiera)

Hay dos formas de arrancar la pregunta «¿Qué te ha parecido la guía y qué has aprendido con ella?». Conviene montar las dos.

### A. Instagram Ref URL (la principal)
Es un enlace especial a tu chat que arranca una automatización concreta cuando alguien lo abre. Solo lo usa quien pulsa el botón del visor, así que no se cuela nadie.

1. En ManyChat, crea una **automatización nueva** y, como disparador, elige **«Instagram Ref URL»** (puede aparecer en «Herramientas de crecimiento» o entre los disparadores de Instagram, según tu versión).
2. Ponle un nombre al parámetro, por ejemplo `opinion_guias`. ManyChat te da un enlace del tipo `https://ig.me/m/blakebraider?ref=opinion_guias`.
3. Copia ese enlace y pásamelo: lo pongo en el botón del visor (o tú, con la variable `GUIA_URL_CHAT` en Vercel).
4. Qué ve la persona al abrirlo lo decide ManyChat, no yo. Pruébalo tú desde el visor.

### B. Palabra clave «OPINIÓN» (el respaldo), con comprobación
1. Disparador: **mensaje que es exactamente «OPINIÓN»** (no «contiene»), para que un «hola, quiero darte mi opinión sobre…» no lo active.
2. Primer paso: una **petición externa** `https://leads-setter.vercel.app/api/manychat/elegible?mc={{user_id}}` (misma cabecera `x-manychat-secret`). El sistema comprueba que la persona rellenó el formulario de COBRAR hace menos de 2 días, que descargó el PDF o abrió el visor y que aún no ha contado su opinión. Deja **«si»** o **«no»** en el campo `guia_elegible` (créalo en ManyChat, de texto).
3. Siguiente paso: una **condición**. Si `guia_elegible` es «si», sigue con la pregunta de la guía. Si no, **no hagas nada** (el flujo termina y no se envía ningún mensaje): es una conversación normal que llevas tú.

Tanto A como B terminan en el mismo sitio: «¿Qué te ha parecido la guía y qué has aprendido con ella?» → petición `valoracion=` → mensaje `{{guia_respuesta}}` → pregunta de la asesoría.
