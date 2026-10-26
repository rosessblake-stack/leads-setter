# Pendientes y hoja de ruta

## En curso: leads de formación (presencial, online y asesoría)
Orden acordado:
1. Panel privado (en curso):
   - Hecho: acceso por `/panel` en Telegram (enlace de un solo uso), lista de leads con filtros y búsqueda, y ficha de cada lead.
   - Pendiente: cambiar la fase de un lead (nuevo, contactado, llamada agendada, llamada hecha, pago pendiente, vendido, no vendido, descartado, en pausa), notas, resultado de la venta (producto, importe, motivo), botón "Abrir ficha" en los avisos de Telegram, recordatorio de leads sin contactar a las 24 h y estadísticas (embudo por ruta y por vídeo).
2. Abrir el formulario al público, conectado a ManyChat con el código del vídeo en el enlace.
3. Hoja de preparación de la llamada, escrita por Claude con las instrucciones del Proyecto Setter.
4. Agendado automático de llamadas (hacen falta las reglas: días, horas, duración, topes).
5. Transcripciones de las llamadas y registro de ventas (la transcripción propone si se vendió y Blake lo confirma).

Pendiente de Blake antes de abrir el formulario al público:
- Datos de la política de privacidad (empresa y número fiscal, dirección, email de contacto, plazo de conservación) y revisión por un gestor o abogado.
- Texto final de la pantalla de gracias y regalo (posiblemente distintos según la ruta).
- Opciones de las preguntas de asesoría A01, A02, A04, A07 y A12 (por ahora son texto libre).

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
