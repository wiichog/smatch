/**
 * Fechas, horas y dinero tal como se dicen en México, no como los guarda el servidor.
 *
 * Todo es tolerante a datos raros (null, cadena vacía, formato inesperado): devuelve ""
 * en vez de tronar, igual que el resto del render de la app (ver la regla de datos
 * defensivos). No usa `Intl`: los nombres van en tablas propias para que el resultado
 * no dependa del motor de JS ni del idioma del teléfono.
 *
 * Zona horaria: las fechas con hora (`scheduled_at`, ISO en UTC) se leen en la hora DEL
 * TELÉFONO, que para un jugador es la de su club. Las fechas sin hora («2026-10-07») son
 * días del club y se arman como día local, sin pasar por UTC (pasar por UTC corre el día).
 */

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** «2026-10-07» → Date a medianoche LOCAL (sin el corrimiento de `new Date(iso)`). */
export function parseLocalDate(iso?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → «2026-10-07» en hora local (lo que espera la API para un día del club). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** «jueves 8 de octubre». */
export function longDay(d: Date): string {
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** «hoy», «mañana» o «jueves 8 de octubre» (en minúscula; capitaliza quien lo use al inicio). */
export function relativeDay(d: Date, now: Date = new Date()): string {
  if (sameDay(d, now)) return "hoy";
  if (sameDay(d, addDays(now, 1))) return "mañana";
  return longDay(d);
}

/** Etiqueta corta para una tira de días: «Hoy», «Mañana», «Jue 9». */
export function shortDayLabel(d: Date, now: Date = new Date()): string {
  if (sameDay(d, now)) return "Hoy";
  if (sameDay(d, addDays(now, 1))) return "Mañana";
  return `${DIAS_CORTOS[d.getDay()]} ${d.getDate()}`;
}

/** «7 oct» — para listas compactas. */
export function shortDate(d: Date): string {
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
}

/** «oct» — el mes corto solo, para una insignia de fecha. */
export function monthShort(d: Date): string {
  return MESES_CORTOS[d.getMonth()];
}

/** «19:00:00» o «19:00» → «19:00». */
export function hhmm(t?: string | null): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  return m ? `${pad(Number(m[1]))}:${m[2]}` : "";
}

/**
 * Cuándo se juega una jornada, para mostrarse junto: `{ day: "Jueves 8 de octubre",
 * time: "20:30" }`. La hora sale de la tanda de la pista si el club la planeó (las pistas
 * de abajo juegan después) y si no, de la hora de la jornada. Cualquier pieza puede
 * venir vacía si el club no calendarizó.
 */
export function roundWhen(
  scheduledAt?: string | null,
  timeSlot?: string | null,
  now: Date = new Date()
): { day: string; time: string } {
  const dt = scheduledAt ? new Date(scheduledAt) : null;
  const valid = dt && !Number.isNaN(dt.getTime()) ? dt : null;
  const day = valid ? capitalize(relativeDay(valid, now)) : "";
  const time = hhmm(timeSlot) || (valid ? `${pad(valid.getHours())}:${pad(valid.getMinutes())}` : "");
  return { day, time };
}

/**
 * Cuándo se jugó algo, corto: «Hoy», «Ayer», «Jue 1 oct» (con el año si no es este).
 * Recibe el `scheduled_at` de la jornada (ISO con hora) y lo lee en la hora del teléfono.
 */
export function playedDay(iso?: string | null, now: Date = new Date()): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  if (sameDay(d, now)) return "Hoy";
  if (sameDay(d, addDays(now, -1))) return "Ayer";
  const base = `${DIAS_CORTOS[d.getDay()]} ${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** «600.00» → «$600»; «150.5» → «$150.50». Siempre pesos (la app no cobra en otra moneda). */
export function money(amount?: string | number | null): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (amount === null || amount === undefined || amount === "" || !Number.isFinite(n)) return "";
  const fixed = n.toFixed(2);
  const [int, dec] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec === "00" ? `$${grouped}` : `$${grouped}.${dec}`;
}

/** «19:00» → «20:30» = «1 h 30 min». */
export function duration(start?: string | null, end?: string | null): string {
  const a = /^(\d{1,2}):(\d{2})/.exec(start ?? "");
  const b = /^(\d{1,2}):(\d{2})/.exec(end ?? "");
  if (!a || !b) return "";
  const mins = Number(b[1]) * 60 + Number(b[2]) - (Number(a[1]) * 60 + Number(a[2]));
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} h ${m} min`;
  return h ? `${h} h` : `${m} min`;
}

/** Los próximos `n` días a partir de hoy (local), para elegir fecha sin teclear. */
export function nextDays(n: number, now: Date = new Date()): Date[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: n }, (_, i) => addDays(today, i));
}
