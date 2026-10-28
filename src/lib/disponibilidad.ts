// Huecos para llamadas: horario, margen alrededor de lo que ya hay en el calendario y días recomendados.
// Todo se calcula en hora de España (Europe/Madrid); los instantes se manejan como Date (UTC).

export type Tipo = "venta" | "asesoria";
export type Ocupado = { inicio: Date; fin: Date };
export type Hueco = { inicio: Date; fin: Date };
export type Dia = { fecha: string; preferido: boolean; huecos: Hueco[] };

export const ZONA = "Europe/Madrid";
export const REGLAS = {
  horaInicio: 11,
  horaFin: 22,
  margenMin: 60,
  paso: 30,
  duracionMin: { venta: 30, asesoria: 60 } as Record<Tipo, number>,
  diasPreferidos: [0, 1], // domingo y lunes: preferencia, no obligación
  diasRecomendados: 3,
  ventaDesdeDias: 1, // la llamada de venta se ofrece a partir de mañana…
  ventaHastaDias: 3, // …y como mucho dentro de 3 días
  asesoriaEsperaDias: 7, // la asesoría se agenda una semana después de confirmar el pago
  asesoriaVentanaDias: 14, // días desde el primero posible entre los que se eligen los 3 recomendados
};

const MIN = 60_000;
const DIA = 24 * 60 * MIN;

type Partes = { y: number; m: number; d: number; h: number; mi: number; dow: number };

export function partesMadrid(t: Date): Partes {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(t).map((x) => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, dow };
}

// Hora local de España -> instante UTC (tiene en cuenta el cambio de hora).
export function madridAUtc(y: number, m: number, d: number, h: number, mi: number): Date {
  let t = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const p = partesMadrid(new Date(t));
    const dif = Date.UTC(y, m - 1, d, h, mi) - Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
    if (dif === 0) break;
    t += dif;
  }
  return new Date(t);
}

const clave = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Huecos libres de un día concreto (y, m, d en España).
export function huecosDelDia(y: number, m: number, d: number, tipo: Tipo, ocupados: Ocupado[], desde: Date): Hueco[] {
  const dur = REGLAS.duracionMin[tipo] * MIN;
  const margen = REGLAS.margenMin * MIN;
  const abre = madridAUtc(y, m, d, REGLAS.horaInicio, 0).getTime();
  const cierra = madridAUtc(y, m, d, REGLAS.horaFin, 0).getTime();
  const huecos: Hueco[] = [];
  for (let t = abre; t + dur <= cierra; t += REGLAS.paso * MIN) {
    if (t < desde.getTime()) continue;
    const choca = ocupados.some((o) => t < o.fin.getTime() + margen && t + dur > o.inicio.getTime() - margen);
    if (!choca) huecos.push({ inicio: new Date(t), fin: new Date(t + dur) });
  }
  return huecos;
}

export type Propuesta = {
  dias: Dia[]; // los recomendados, en orden cronológico
  sinHueco: boolean; // ningún día de la ventana tiene hueco: hay que avisar a Blake
  unSoloPreferido: boolean; // solo uno de los días recomendados es domingo o lunes (aviso para Blake)
};

// ahora: instante actual. pagoAt: solo asesoría (cuándo se confirmó el pago).
export function proponer(tipo: Tipo, ocupados: Ocupado[], ahora: Date, pagoAt?: Date): Propuesta {
  const base = tipo === "asesoria" ? (pagoAt ?? ahora) : ahora;
  const desdeDias = tipo === "asesoria" ? REGLAS.asesoriaEsperaDias : REGLAS.ventaDesdeDias;
  const hastaDias = tipo === "asesoria" ? desdeDias + REGLAS.asesoriaVentanaDias - 1 : REGLAS.ventaHastaDias;

  const p0 = partesMadrid(base);
  const candidatos: Dia[] = [];
  for (let i = desdeDias; i <= hastaDias; i++) {
    // mediodía del día i en España, sin depender del cambio de hora
    const ref = partesMadrid(new Date(Date.UTC(p0.y, p0.m - 1, p0.d, 12) + i * DIA));
    const huecos = huecosDelDia(ref.y, ref.m, ref.d, tipo, ocupados, ahora);
    if (huecos.length > 0) {
      candidatos.push({ fecha: clave(ref.y, ref.m, ref.d), preferido: REGLAS.diasPreferidos.includes(ref.dow), huecos });
    }
  }
  if (candidatos.length === 0) return { dias: [], sinHueco: true, unSoloPreferido: false };

  // Primero los preferidos (domingo/lunes), luego por orden cronológico; se quedan 3.
  const elegidos = [...candidatos]
    .sort((a, b) => Number(b.preferido) - Number(a.preferido) || a.fecha.localeCompare(b.fecha))
    .slice(0, REGLAS.diasRecomendados)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const preferidos = elegidos.filter((d) => d.preferido).length;
  return { dias: elegidos, sinHueco: false, unSoloPreferido: preferidos === 1 && elegidos.length > 1 };
}
