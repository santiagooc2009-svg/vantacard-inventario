import { mxn, pct } from '@/lib/format';

const CX = 100;
const CY = 100;
const R = 80;
const clamp01 = (n) => Math.min(Math.max(Number(n) || 0, 0), 1);
const point = (f, r = R) => {
  const a = Math.PI * (1 - f);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)].map((n) => n.toFixed(2));
};
const arc = (f0, f1) => {
  const [x0, y0] = point(f0);
  const [x1, y1] = point(f1);
  return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`;
};

// Velocímetro: el arco se llena hasta `value` sobre una escala de 0 a `max`.
// mark: una rayita (por ejemplo, el punto de equilibrio); a su derecha el fondo se pinta de verde.
// El arco es azul mientras no llegas a la rayita (o al máximo) y verde cuando ya llegaste.
export function Gauge({ value, max, mark, markLabel, label }) {
  const f = clamp01(value / max);
  const mf = mark != null ? clamp01(mark / max) : null;
  const reached = value >= (mark ?? max);
  const [nx, ny] = point(f, R - 24);
  const [t0x, t0y] = mf != null ? point(mf, R - 13) : [];
  const [t1x, t1y] = mf != null ? point(mf, R + 13) : [];
  const [lx, ly] = mf != null ? point(mf, R + 24) : [];
  return (
    <svg className="gauge" viewBox={markLabel ? '0 -16 200 128' : '0 8 200 104'} role="img" aria-label={label}>
      <path d={arc(0, 1)} className="g-track" />
      {mf != null && mf < 1 && <path d={arc(mf, 1)} className="g-gain" />}
      {f > 0.002 && <path d={arc(0, f)} className={reached ? 'g-fill tone-profit' : 'g-fill tone-in'} />}
      {mf != null && (
        <>
          <line x1={t0x} y1={t0y} x2={t1x} y2={t1y} className="g-tick" />
          {markLabel && <text x={lx} y={ly} className="g-label" textAnchor="middle">{markLabel}</text>}
        </>
      )}
      <line x1={CX} y1={CY} x2={nx} y2={ny} className="g-needle" />
      <circle cx={CX} cy={CY} r="7" className="g-hub" />
    </svg>
  );
}

// Leyenda con valores: hace de tabla para las barras (cada color con su número).
export function Legend({ items, total }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}>
          <i className={'sw tone-' + i.tone} aria-hidden="true" />
          <span className="legend-label">{i.label}</span>
          <strong>{mxn(i.value)}</strong>
          {total > 0 && <span className="legend-share">{pct(i.value / total)}</span>}
        </li>
      ))}
    </ul>
  );
}

// Flecha y diferencia contra el periodo anterior. goodUp: si subir es bueno (ventas) o malo (gastos).
export function Delta({ now, before, vs, goodUp = true, money = false }) {
  if (before == null || (!money && !before)) return null;
  const diff = now - before;
  if (Math.abs(diff) < 0.005) return <span className="delta muted">= igual que {vs}</span>;
  const up = diff > 0;
  const good = up === goodUp;
  const amount = money ? mxn(Math.abs(diff)) : pct(Math.abs(diff) / Math.abs(before));
  return (
    <span className={'delta ' + (good ? 'pos' : 'neg')}>
      <span aria-hidden="true">{up ? '▲' : '▼'}</span> {amount} vs {vs}
    </span>
  );
}
