# Registro de proveedores que tratan datos de los leads

Borrador para completar con Blake y revisar con un abogado. Cada proveedor trata datos «por encargo» de BlakeBraider, LLC.
Hay que aceptar o guardar su acuerdo de tratamiento de datos (DPA) y comprobar las transferencias fuera de la UE.

| Proveedor | Para qué | Qué datos ve | Dónde | Qué hacer |
|---|---|---|---|---|
| Supabase | Base de datos | Todo lo del formulario, fichas, notas, reservas | UE (proyecto en eu-west-1) | Aceptar el DPA desde la cuenta; pasar a Pro para tener copias de seguridad |
| Vercel | Alojamiento de la web y funciones | Todo lo que pasa por la web | Región dub1 (Irlanda); soporte y registros pueden salir de la UE | Aceptar el DPA; el plan Hobby no permite uso comercial: pasar a Pro |
| Anthropic | Análisis de cada formulario | Respuestas del cuestionario (sin nombre, email, teléfono ni enlaces) | EE. UU. | DPA y revisar la política de retención (poner retención cero si es posible) |
| Telegram | Aviso interno a Blake | Nombre, ruta, resumen y propuesta preparada | Servidores de Telegram | Es una herramienta interna: valorar si basta con avisar sin datos personales |
| ManyChat | Conversación de Instagram y envío de la propuesta | Nombre de usuario, mensajes, nombre y texto de la propuesta | EE. UU. | Aceptar el DPA de ManyChat |
| Google (Workspace) | Calendario y videollamada | Nombre y email de quien reserva | UE/EE. UU. | Usar el DPA de Workspace |
| Stripe | Pago de la asesoría | Email, pago | EE. UU./UE | DPA de Stripe; datos de facturación se conservan por ley |
| Meta (Instagram) | Origen de los leads | Lo que la persona escribe en Instagram | EE. UU. | Política propia de Meta |

## Procedimiento de supresión (derecho al olvido)
1. En el panel: abrir la ficha → «Borrar a esta persona» → escribir BORRAR. Borra la base de datos y sus eventos del calendario.
2. A mano: borrar el contacto en ManyChat y los mensajes del bot en Telegram.
3. Supabase: las copias de seguridad caducan solas (con el plan Pro, según su retención).
4. Los datos de pagos y facturas que haya que conservar por ley quedan en Stripe y en la contabilidad.
5. Anotar la fecha de la petición y de la respuesta (plazo máximo: un mes). En la base de datos queda un registro sin datos personales en `setter.borrados`.

## Pendiente de decisión legal
- Plazo de conservación (propuesta: 24 meses desde la última interacción) y número fiscal de la LLC.
- Edad mínima: confirmar que el formulario es para mayores de 14 años (con una casilla) o pedir consentimiento de los tutores.
- Consentimiento separado para comunicaciones posteriores (casilla sin premarcar), y guardar la versión del texto aceptado.
- Derecho de desistimiento de 14 días en servicios a consumidores de la UE (la asesoría se presta 7 días después del pago): cómo se renuncia o se informa.
- IVA y facturación.
