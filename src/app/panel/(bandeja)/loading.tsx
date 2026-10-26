// Se muestra al instante mientras se cargan los datos, para que el panel responda al toque.
export default function Cargando() {
  return (
    <main className="pantalla panel" aria-busy="true" aria-label="Cargando">
      <header className="panel-cabecera">
        <h1>Leads</h1>
      </header>
      <div className="esqueleto">
        <span className="corto" />
        <span />
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
