import type { Metadata } from "next";
import { Formulario } from "@/app/guia/formulario";
import { definicion } from "@/formulario/datos";
import { CONSENT_TEXT } from "@/lib/consent";
import { intentar } from "@/lib/db";
import { cargarPreparacion } from "@/lib/preparacion";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata: Metadata = { title: "Prepara tu asesoría", robots: { index: false, follow: false } };

export default async function Preparar({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const p = await intentar(() => cargarPreparacion(token));
  if (!p || p.expira_at.getTime() < Date.now()) {
    return (
      <main className="pantalla">
        <section className="centro bienvenida">
          <h1>Este enlace ya no es válido</h1>
          <p className="intro">Escríbeme por Instagram y te paso uno nuevo.</p>
        </section>
      </main>
    );
  }
  return (
    <main className="envoltorio">
      <Formulario
        definicion={definicion}
        video=""
        manychat=""
        textoConsentimiento={CONSENT_TEXT}
        privacidad={process.env.PRIVACY_URL || "/privacidad"}
        modo="preparacion"
        ruta="asesoria"
        token={token}
      />
    </main>
  );
}
