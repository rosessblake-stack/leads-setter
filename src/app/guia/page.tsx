import { Formulario } from "./formulario";
import { CONSENT_TEXT } from "@/lib/consent";

type Params = { v?: string | string[]; mc?: string | string[] };

const uno = (x?: string | string[]) => (Array.isArray(x) ? x[0] : x);

export default async function Guia({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  return (
    <main className="envoltorio">
      <h1>Tu guía gratuita</h1>
      <p className="intro">
        Cuéntame un poco sobre ti para enviarte la guía y orientarte mejor. Tarda un par de minutos.
      </p>
      <Formulario
        video={uno(p.v) ?? ""}
        manychat={uno(p.mc) ?? ""}
        textoConsentimiento={CONSENT_TEXT}
        privacidad={process.env.PRIVACY_URL ?? ""}
      />
    </main>
  );
}
