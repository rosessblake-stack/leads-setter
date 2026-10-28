# Pendientes y hoja de ruta

## En curso: leads de formación (presencial, online y asesoría)
Orden acordado:
1. Panel privado (en curso):
   - Hecho: acceso por `/panel` en Telegram (enlace de un solo uso), lista de leads con filtros y búsqueda, ficha de cada lead y seguimiento completo: fase, estado de la propuesta (pendiente, enviada, no se pudo enviar, enviada a mano), reserva de la llamada, resultado de la venta (producto, importe, forma de pago, edición o motivo), notas e historial. Bandeja con las vistas Por enviar, Sin agendar, Agendadas, Vendidos y No vendidos. Enlace "Abrir ficha" en los avisos de Telegram.
   - Pendiente: recordatorio de leads sin contactar a las 24 h y estadísticas (embudo por ruta y por vídeo).
2. Abrir el formulario al público, conectado a ManyChat con el código del vídeo en el enlace.
3. Hoja de preparación de la llamada, escrita por Claude con las instrucciones del Proyecto Setter.
4. Agendado automático de llamadas (hacen falta las reglas: días, horas, duración, topes).
5. Transcripciones de las llamadas y registro de ventas (la transcripción propone si se vendió y Blake lo confirma).

Pendiente de Blake antes de abrir el formulario al público:
- Datos de la política de privacidad (empresa y número fiscal, dirección, email de contacto, plazo de conservación) y revisión por un gestor o abogado.
- Regalo al terminar el formulario (posiblemente distinto según la ruta). Los textos finales por ruta ya están escritos en `src/formulario/preguntas.json` (`final.rutas`); revisarlos.
- Opciones de las preguntas de asesoría A01, A02, A04, A07 y A12 (por ahora son texto libre).

## Flujo acordado tras el formulario (26 de octubre de 2026)
Decisiones de Blake:
- El formulario ya **no pide teléfono ni canal**: se pide el usuario de Instagram y se contacta por Instagram. El teléfono de Blake (WhatsApp) solo se da, a mano, a quien va en serio con la formación presencial.
- **Propuesta automática** por Instagram (ManyChat) unas horas después de rellenar, siempre **dentro de la ventana de 24 horas**. Si no se pudo enviar, el panel y Telegram muestran el mensaje listo para copiar y un botón para abrir su chat (`ig.me`).
- Presencial: se recomienda siempre la de **3 días**. Si Claude ve que a esa persona le encajaría mejor 1 día, avisa por Telegram y Blake decide.
- Presencial y online: la propuesta invita a una **llamada**, que se agenda en una **página de reserva propia** conectada a Google Calendar (días y horas distintos para llamadas de venta y para llamadas de asesoría).
- Asesoría: se explica que es **teórica** (negocio, redes, clientela, no técnica), se envía el precio y el enlace de pago de Stripe; al pagar se reserva la hora.
- Las primeras 5–10 propuestas se envían a Blake por Telegram, no a la persona, para calibrar el tono. Después, envío automático.
- El panel muestra por lead: propuesta (pendiente, enviada, no enviada), reserva (sin agendar, agendada), pago (asesoría) y resultado (en curso, vendido, no vendido).

Pendiente de Blake: enlace de pago de Stripe de la asesoría, descripción breve de cada oferta (presencial 3 días, online, asesoría), días y horas de llamadas (venta y asesoría), espera antes de enviar (horas) y datos para conectar Google Calendar y ManyChat.

## Más adelante: ficha de clientes del salón (no es para ahora)
Idea de Blake: hacer algo parecido a lo del formulario de leads, pero para los clientes del día a día del salón.

Objetivo: tener una ficha de cada cliente para entender su motivación real y su "vida" con el negocio, y poder calcular el valor de vida (LTV, lifetime value).

Qué debería recoger:
- De dónde viene (Instagram, recomendación, búsqueda, etc.) y por qué vino.
- Si ya había venido antes.
- Si llegó por referencia y de quién.
- Si comparó con otros salones o precios antes de decidirse.
- Su motivación real para venir.
- Historial de visitas, importes y frecuencia, para el LTV.

Notas de partida (revisar cuando se haga, sin tocar nada de momento):
- El proyecto Kira (citas) ya tiene tablas de clientes, reservas y registros de servicio en su propio Supabase. Habrá que mirar qué se puede reutilizar y cómo conectarlo sin mezclar datos de clientes con los de leads.
- Misma filosofía: formulario corto, datos con consentimiento y ficha privada.

## Otras ideas apuntadas
- Panel de análisis de contenido con la API de Instagram (qué vídeos traen leads y ventas).
- Conexión de ventas desde Stripe (las compras de Kajabi y las asesorías pasan por Stripe).

## Ruta de avatares y predicción de compra (idea de Blake, 28-oct-2026)

Objetivo: con el tiempo, saber qué tipo de persona compra, cuál pospone y cuál no compra, por ruta, y llegar a la llamada sabiendo cómo llevarla (dónde apretar, dónde no) y con un porcentaje de probabilidad propio.

Qué hay que registrar desde ya, aunque todavía no se use (sin datos no hay avatar):
- Tiempos: del formulario a la propuesta, de la propuesta a la reserva, de la reserva a la llamada, de la llamada a la decisión.
- Si abre y descarga el regalo gratuito (hace falta un enlace con seguimiento).
- Resultado y motivo de cada lead (ya se guarda: vendido, no vendido, motivo, y «lo piensa» = pospone).
- Nivel real visto por Blake, distinto del que se pone la persona (verdad de referencia para entrenar).
- Vídeo de origen y ruta (ya se guarda).

Cómo se construye, por etapas:
1. Ahora (0 ventas): solo registrar. La puntuación actual es la opinión de Claude sobre el formulario, no una predicción aprendida.
2. Con unas decenas de resultados: tabla «puntuación prevista contra resultado real» y primeros perfiles por ruta (dolores, nivel, tiempos, regalo).
3. Con más volumen: avatares con nombre (por ejemplo, «el que compra a la primera», «el que pospone») y guía de llamada por avatar. La probabilidad pasa a calcularse con datos propios.

Asesoría (datos de Blake): la persona se lleva un plan de acción para el mes; Blake hace seguimiento informal; objetivo de una asesoría cada mes y medio; después ofrece packs de 3 o 4 asesorías (precio de pack, no descuento). Reserva de la llamada una semana después del pago. Si no puede asistir: se cambia el día, nunca hay devolución (lo gestiona Blake a mano). Materiales: siempre incluidos en el precio; el cliente no los ve desglosados, pero el profesional debe tenerlos desglosados.
Niveles: años trabajando, clientes al mes, lo que cobra, y sobre todo cómo se ve su trabajo de cerca para un profesional de nivel élite.
