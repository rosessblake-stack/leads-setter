// Dirección pública del panel (la que va en los enlaces que se mandan por Telegram).
export const urlPanel = () => (process.env.PANEL_BASE_URL ?? "https://leads-setter.vercel.app").replace(/\/$/, "");
