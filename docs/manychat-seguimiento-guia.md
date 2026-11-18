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
