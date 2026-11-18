import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Si alguien abre el PDF directamente, que se descargue en vez de verse dentro del navegador.
      { source: "/guia-cobrar-y-datos.pdf", headers: [{ key: "Content-Disposition", value: 'attachment; filename="guia-cobrar-y-datos.pdf"' }] },
    ];
  },
};

export default config;
