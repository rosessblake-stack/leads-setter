// Texto de la política de privacidad. Los huecos [PENDIENTE: ...] se rellenan con los datos reales
// del responsable antes de abrir el formulario al público. Revisar con un gestor o abogado.
export type Seccion = { titulo: string; parrafos: string[] };

export const privacidad: { titulo: string; actualizado: string; secciones: Seccion[] } = {
  titulo: "Política de privacidad",
  actualizado: "28 de octubre de 2026 (borrador pendiente de revisión legal)",
  secciones: [
    {
      titulo: "1. Quién es el responsable",
      parrafos: [
        "El responsable del tratamiento es BlakeBraider, LLC (Blake Braider, @blakebraider).",
        "Dirección: 651 N Broad St, Suite 201, Middletown, DE 19709, EE. UU. Teléfono: +1 (516) 512-1626. Contacto para temas de privacidad: info@blakebraider.com.",
      ],
    },
    {
      titulo: "2. Qué datos recogemos",
      parrafos: [
        "Los que escribes en el formulario de solicitud: nombre, email, tu Instagram o enlace a tu trabajo, tu ciudad y país, y tus respuestas sobre tu experiencia, tu negocio (clientes, ingresos aproximados, precios, forma de trabajar), tus dudas y lo que quieres conseguir.",
        "Si estás en la ruta de formación presencial, se te pregunta por molestias físicas al trabajar (espalda, manos, cuello). Esa respuesta puede considerarse un dato de salud: es opcional y solo la tratamos si la das, con tu consentimiento explícito.",
        "Datos técnicos mínimos: tu zona horaria, la fecha y hora en que empiezas y envías el formulario, el vídeo o enlace desde el que llegaste y el identificador de tu conversación de Instagram en ManyChat.",
      ],
    },
    {
      titulo: "3. Para qué los usamos",
      parrafos: [
        "Para valorar tu solicitud, prepararnos para hablar contigo, contactarte por el canal que elijas y proponerte la formación o asesoría que mejor encaje contigo.",
        "Para enviarte el material gratuito que se ofrezca y, si compras, para gestionar tu inscripción.",
        "Para entender, de forma agregada, qué contenidos y qué solicitudes funcionan mejor y así mejorar nuestro trabajo.",
      ],
    },
    {
      titulo: "4. Base legal",
      parrafos: [
        "Tu consentimiento (artículo 6.1.a del RGPD), que das marcando la casilla antes de enviar el formulario. Puedes retirarlo en cualquier momento escribiendo al contacto indicado arriba; la retirada no afecta a lo ya hecho antes.",
      ],
    },
    {
      titulo: "5. Valoración con inteligencia artificial",
      parrafos: [
        "Usamos un modelo de inteligencia artificial para leer tus respuestas y preparar una ficha con un resumen, una oferta recomendada y una valoración orientativa de encaje. No enviamos al modelo tu nombre, email ni enlaces; sí tus respuestas al cuestionario.",
        "Esta valoración es una ayuda interna. No se toma ninguna decisión automática que te produzca efectos legales o te afecte de forma significativa: una persona revisa cada solicitud.",
      ],
    },
    {
      titulo: "6. Con quién compartimos los datos",
      parrafos: [
        "No vendemos tus datos. Los tratan, por encargo nuestro, los proveedores que hacen funcionar el servicio: Supabase (base de datos, en la Unión Europea), Vercel (alojamiento de la web), Anthropic (análisis con inteligencia artificial) y Telegram (aviso interno a la persona responsable). ManyChat gestiona la conversación de Instagram que te trae al formulario, con su propia política.",
        "Algunos de estos proveedores están o pueden tratar datos fuera de la Unión Europea. En esos casos se apoyan en las garantías previstas por el RGPD, como las cláusulas contractuales tipo o el Marco de Privacidad de Datos UE–EE. UU.",
      ],
    },
    {
      titulo: "7. Cuánto tiempo los conservamos",
      parrafos: [
        "[PENDIENTE: plazo de conservación, por ejemplo, 24 meses desde tu última interacción] o hasta que retires tu consentimiento, lo que ocurra antes. Después los borramos o los anonimizamos.",
      ],
    },
    {
      titulo: "8. Tus derechos",
      parrafos: [
        "Puedes pedir acceso a tus datos, que los rectifiquemos o los borremos, limitar su tratamiento, oponerte a él o recibirlos en un formato portable. Escribe al contacto indicado arriba y responderemos en un plazo máximo de un mes.",
        "Si crees que no hemos tratado bien tus datos, puedes reclamar ante la autoridad de control de tu país. En España, la Agencia Española de Protección de Datos (www.aepd.es).",
      ],
    },
    {
      titulo: "9. Almacenamiento en tu navegador",
      parrafos: [
        "Para que no pierdas lo que has respondido si recargas la página, el formulario guarda tus respuestas en el almacenamiento de tu propio navegador. No se envían a nuestros servidores hasta que pulsas «Enviar solicitud», y se borran al enviar. No usamos cookies de seguimiento ni de publicidad.",
      ],
    },
  ],
};
