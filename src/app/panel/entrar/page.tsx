import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_PANEL, sesionValida } from "@/lib/panel";

type Params = { t?: string | string[]; error?: string | string[] };

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel" };

export default async function Entrar({ searchParams }: { searchParams: Promise<Params> }) {
  // Si ya estás dentro, no hace falta otro enlace.
  if (await sesionValida((await cookies()).get(COOKIE_PANEL)?.value).catch(() => false)) redirect("/panel");

  const p = await searchParams;
  const t = Array.isArray(p.t) ? p.t[0] : p.t;
  const hayError = Boolean(p.error);

  return (
    <main className="pantalla">
      <section className="centro bienvenida">
        <h1>Panel</h1>
        {hayError && (
          <p className="error" role="alert">
            Ese enlace ya se usó o ha caducado.
          </p>
        )}
        {t ? (
          <>
            <p className="intro">Pulsa para entrar. El enlace solo funciona una vez.</p>
            <form method="post" action="/panel/entrar/accion">
              <input type="hidden" name="t" value={t} />
              <button type="submit" className="principal">
                Entrar al panel
              </button>
            </form>
          </>
        ) : (
          <p className="intro">
            Para entrar, escribe <b>/panel</b> en @blakeleads_bot y abre el enlace que te mande.
          </p>
        )}
      </section>
    </main>
  );
}
