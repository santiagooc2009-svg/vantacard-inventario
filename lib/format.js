const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
export const mxn = (n) => money.format(Number(n) || 0);

export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

// El negocio empezó en octubre de 2026: en Finanzas, lo de antes (la inversión de septiembre)
// cuenta como de octubre. Las fechas reales de pedidos y ventas no cambian.
export const INICIO = '2026-10';
export const mesDe = (date) => {
  const m = String(date ?? '').slice(0, 7);
  return m < INICIO ? INICIO : m;
};

// Cuántos meses van de `desde` a `hasta`, contando los dos (YYYY-MM).
export function mesesEntre(desde, hasta) {
  const [y1, m1] = desde.split('-').map(Number);
  const [y2, m2] = hasta.split('-').map(Number);
  return Math.max((y2 - y1) * 12 + (m2 - m1) + 1, 0);
}

export function thisMonth() {
  return today().slice(0, 7);
}

const dateFmt = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const fecha = (iso) => (iso ? dateFmt.format(new Date(iso + 'T00:00:00Z')) : '');

const monthFmt = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const mes = (ym) => {
  const s = monthFmt.format(new Date(ym + '-01T00:00:00Z'));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;

const monthShortFmt = new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric', timeZone: 'UTC' });
export const mesCorto = (ym) => monthShortFmt.format(new Date(ym + '-01T00:00:00Z')).replace('.', '');

// Mes anterior en formato YYYY-MM.
export function mesAnterior(ym) {
  const d = new Date(ym + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

const dayFmt = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
// Día de entrega para leer rápido: "hoy", "mañana" o "jueves 8 oct".
export function diaEntrega(iso) {
  const t = today();
  if (iso === t) return 'hoy';
  const next = new Date(t + 'T00:00:00Z');
  next.setUTCDate(next.getUTCDate() + 1);
  if (iso === next.toISOString().slice(0, 10)) return 'mañana';
  return dayFmt.format(new Date(iso + 'T00:00:00Z')).replace(',', '').replace('.', '');
}
