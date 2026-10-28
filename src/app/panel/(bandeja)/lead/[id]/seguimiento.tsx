import { EnlaceReserva, FormularioAjax, Pildoras } from "../../ajax";
import {
  FASES_MANUALES,
  FORMAS_PAGO,
  MOTIVOS,
  NOMBRE_FORMA_PAGO,
  NOMBRE_MOTIVO,
  NOMBRE_PRODUCTO,
  NOMBRE_PROPUESTA,
  PRODUCTOS,
  PROPUESTAS,
  type Propuesta,
} from "@/lib/seguimiento-util";
import { NOMBRE_FASE, fechaCorta, type Fase } from "@/lib/panel-util";

export type DatosSeguimiento = {
  id: string;
  ruta: string | null;
  fase: Fase;
  propuesta_estado: Propuesta;
  propuesta_at: Date | null;
  reserva_input: string | null;
  resultado: {
    resultado: "vendido" | "no_vendido";
    producto: string | null;
    importe_cents: number | null;
    forma_pago: string | null;
    edicion: string | null;
    motivo: string | null;
    nota: string | null;
  } | null;
  notas: { texto: string; creado_at: Date }[];
};

const dinero = (c: number | null) =>
  c === null ? "—" : (c / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

export function Seguimiento({ d, aviso }: { d: DatosSeguimiento; aviso: { tipo: "ok" | "error"; texto: string } | null }) {
  const accion = `/panel/lead/${d.id}/accion`;
  const r = d.resultado;

  return (
    <section className="bloque seguimiento" id="seguimiento">
      <h2>Seguimiento</h2>
      {aviso && (
        <p className={aviso.tipo === "ok" ? "aviso" : "error"} role={aviso.tipo === "ok" ? "status" : "alert"}>
          {aviso.texto}
        </p>
      )}

      <div className="subbloque">
        <h3>Fase</h3>
        <Pildoras action={accion} accion="fase" campo="fase" activo={d.fase} opciones={FASES_MANUALES.map((f) => ({ valor: f, etiqueta: NOMBRE_FASE[f] }))} />
        {(d.fase === "vendido" || d.fase === "no_vendido") && (
          <p className="ayuda">Ahora mismo: {NOMBRE_FASE[d.fase]}. Si eliges otra fase, el resultado registrado se quita.</p>
        )}
      </div>

      <div className="subbloque">
        <h3>Propuesta</h3>
        <p className="ayuda">
          {NOMBRE_PROPUESTA[d.propuesta_estado]}
          {d.propuesta_at && d.propuesta_estado !== "pendiente" ? ` · ${fechaCorta(d.propuesta_at)}` : ""}
        </p>
        <Pildoras action={accion} accion="propuesta" campo="estado" activo={d.propuesta_estado} opciones={PROPUESTAS.map((p) => ({ valor: p, etiqueta: NOMBRE_PROPUESTA[p] }))} />
      </div>

      <div className="subbloque">
        <h3>Enlace de reserva</h3>
        <p className="ayuda">
          Página personal donde la persona elige hora. Ofrece 3 días con tus reglas
          {d.ruta === "asesoria" ? " (a partir de una semana desde hoy, porque se entiende que ya ha pagado)" : " (de 1 a 3 días desde hoy)"}.
        </p>
        <EnlaceReserva action={`/panel/lead/${d.id}/enlace`} tipo={d.ruta === "asesoria" ? "asesoria" : "venta"} />
      </div>

      <div className="subbloque">
        <h3>Reserva de la llamada</h3>
        <FormularioAjax action={accion} className="reserva">
          <input type="hidden" name="accion" value="reserva" />
          <label>
            <span className="solo-lectores">Fecha y hora (hora de España)</span>
            <input type="datetime-local" name="reserva" defaultValue={d.reserva_input ?? ""} />
          </label>
          <button type="submit" className="secundario">Guardar</button>
        </FormularioAjax>
        <p className="ayuda">Hora de España. Para quitar la reserva, borra la fecha y guarda.</p>
      </div>

      <div className="subbloque">
        <h3>Resultado de la venta</h3>
        {r && (
          <p className="resumen">
            {r.resultado === "vendido"
              ? `Vendido: ${NOMBRE_PRODUCTO[r.producto as keyof typeof NOMBRE_PRODUCTO] ?? r.producto} · ${dinero(r.importe_cents)}${r.forma_pago ? ` · ${NOMBRE_FORMA_PAGO[r.forma_pago as keyof typeof NOMBRE_FORMA_PAGO] ?? r.forma_pago}` : ""}${r.edicion ? ` · ${r.edicion}` : ""}`
              : `No vendido: ${NOMBRE_MOTIVO[r.motivo as keyof typeof NOMBRE_MOTIVO] ?? r.motivo}`}
            {r.nota ? ` — ${r.nota}` : ""}
          </p>
        )}
        <details open={!r}>
          <summary>{r ? "Corregir el resultado" : "Registrar el resultado"}</summary>
          <FormularioAjax action={accion} className="formulario-seg">
            <input type="hidden" name="accion" value="resultado" />
            <fieldset>
              <legend>Si ha comprado</legend>
              <label>Producto
                <select name="producto" defaultValue={r?.producto ?? ""}>
                  <option value="">Elige…</option>
                  {PRODUCTOS.map((p) => <option key={p} value={p}>{NOMBRE_PRODUCTO[p]}</option>)}
                </select>
              </label>
              <label>Importe (€)
                <input type="text" inputMode="decimal" name="importe" defaultValue={r?.importe_cents != null ? String(r.importe_cents / 100) : ""} placeholder="Por ejemplo, 2000" />
              </label>
              <label>Forma de pago
                <select name="forma_pago" defaultValue={r?.forma_pago ?? ""}>
                  <option value="">Sin indicar</option>
                  {FORMAS_PAGO.map((p) => <option key={p} value={p}>{NOMBRE_FORMA_PAGO[p]}</option>)}
                </select>
              </label>
              <label>Edición o fechas (presencial)
                <input type="text" name="edicion" maxLength={100} defaultValue={r?.edicion ?? ""} />
              </label>
            </fieldset>
            <fieldset>
              <legend>Si no ha comprado</legend>
              <label>Motivo
                <select name="motivo" defaultValue={r?.motivo ?? ""}>
                  <option value="">Elige…</option>
                  {MOTIVOS.map((m) => <option key={m} value={m}>{NOMBRE_MOTIVO[m]}</option>)}
                </select>
              </label>
            </fieldset>
            <label>Nota (opcional)
              <input type="text" name="nota" maxLength={500} defaultValue={r?.nota ?? ""} />
            </label>
            <div className="botonera">
              <button type="submit" name="resultado" value="vendido" className="principal">Registrar como vendido</button>
              <button type="submit" name="resultado" value="no_vendido" className="secundario">Registrar como no vendido</button>
            </div>
          </FormularioAjax>
        </details>
      </div>

      <div className="subbloque">
        <h3>Notas</h3>
        <FormularioAjax action={accion} className="nota-form" limpiar>
          <input type="hidden" name="accion" value="nota" />
          <label>
            <span className="solo-lectores">Nueva nota</span>
            <textarea name="texto" rows={3} maxLength={2000} placeholder="Lo que quieras recordar de esta persona" required />
          </label>
          <button type="submit" className="secundario">Guardar nota</button>
        </FormularioAjax>
        {d.notas.length > 0 && (
          <ul className="notas">
            {d.notas.map((n, i) => (
              <li key={i}>
                <span className="lead-fecha">{fechaCorta(n.creado_at)}</span>
                <span className="nota-texto">{n.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
