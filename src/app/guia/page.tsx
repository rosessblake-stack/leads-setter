import { Formulario } from "./formulario";
import { CONSENT_TEXT } from "@/lib/consent";
import { definicion } from "@/formulario/datos";

type Params = { v?: string | string[]; mc?: string | string[] };

const uno = (x?: string | string[]) => (Array.isArray(x) ? x[0] : x);

export default async function Guia({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  return (
    <main className="envoltorio">
      <Formulario
        definicion={definicion}
        video={uno(p.v) ?? ""}
        manychat={uno(p.mc) ?? ""}
        textoConsentimiento={CONSENT_TEXT}
        privacidad={process.env.PRIVACY_URL || "/privacidad"}
      />
    </main>
  );
}
