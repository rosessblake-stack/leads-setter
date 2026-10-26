import Link from "next/link";
import { privacidad } from "@/formulario/privacidad";

export const metadata = { title: "Política de privacidad" };

// Resalta los huecos que faltan por rellenar.
function Texto({ t }: { t: string }) {
  return (
    <>
      {t.split(/(\[PENDIENTE:[^\]]*\])/).map((parte, i) =>
        parte.startsWith("[PENDIENTE:") ? (
          <span key={i} className="pendiente">
            {parte}
          </span>
        ) : (
          parte
        ),
      )}
    </>
  );
}

export default function Privacidad() {
  return (
    <main className="pantalla documento">
      <p className="contador">{privacidad.titulo}</p>
      <h1>{privacidad.titulo}</h1>
      <p className="ayuda">Última actualización: {privacidad.actualizado}</p>
      {privacidad.secciones.map((s) => (
        <section key={s.titulo}>
          <h2>{s.titulo}</h2>
          {s.parrafos.map((p, i) => (
            <p key={i}>
              <Texto t={p} />
            </p>
          ))}
        </section>
      ))}
      <p>
        <Link href="/guia">Volver al formulario</Link>
      </p>
    </main>
  );
}
