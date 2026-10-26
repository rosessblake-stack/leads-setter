"use client";

// Si algo falla al cargar el panel, se muestra esto en vez de dejar la pantalla en blanco.
export default function ErrorPanel({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="pantalla">
      <section className="centro bienvenida" role="alert">
        <h1>Algo ha fallado</h1>
        <p className="intro">No se ha podido cargar esta pantalla. Prueba otra vez en unos segundos.</p>
        <button type="button" className="principal" onClick={reset}>
          Reintentar
        </button>
      </section>
    </main>
  );
}
