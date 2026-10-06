const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
export const mxn = (n) => money.format(Number(n) || 0);

export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
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
