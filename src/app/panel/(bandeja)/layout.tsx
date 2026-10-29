import { Suspense } from "react";
import { Barra } from "./barra";

// Marco común del panel: barra lateral fija y, al lado, cada pantalla.
export default function MarcoPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="marco">
      <Suspense fallback={null}>
        <Barra />
      </Suspense>
      <div className="contenido">{children}</div>
    </div>
  );
}
