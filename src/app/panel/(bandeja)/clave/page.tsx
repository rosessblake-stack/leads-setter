import Link from "next/link";
import { exigirSesion } from "@/lib/panel";
import { Generador } from "./generador";

export const dynamic = "force-dynamic";
export const metadata = { title: "Generar clave" };

export default async function Clave() {
  await exigirSesion();
  return (
    <main className="pantalla panel">
      <p>
        <Link href="/panel/ajustes">← Volver a Ajustes</Link>
      </p>
      <h1>Generar una clave aleatoria</h1>
      <p className="ayuda">
        Sirve para claves como la de ManyChat. Se crea en tu navegador: no se envía a ningún servidor ni se guarda en ningún sitio. Copia la
        clave y pégala directamente donde la necesites (por ejemplo, en la variable de Vercel y en la cabecera de ManyChat). Si cierras la
        página, no se puede recuperar: genera otra.
      </p>
      <Generador />
    </main>
  );
}
