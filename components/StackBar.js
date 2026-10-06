'use client';
import { useState } from 'react';

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const pct = (n) => `${(Math.min(Math.max(n, 0), 1) * 100).toFixed(2)}%`;

// Barra horizontal (apilada si trae varios segmentos) con el valor de cada segmento
// al pasar el mouse o tocarla. segments: [{ label, value, tone }].
// scale: el valor que llena todo el ancho, para comparar varias barras entre sí.
// marker: dibuja una rayita en ese valor (por ejemplo, lo que vendiste cuando hubo pérdida).
// pieces: los valores son piezas, no pesos.
export default function StackBar({ segments, scale, marker, size = 'md', pieces = false }) {
  const [active, setActive] = useState(null);
  const show = (v) => (pieces ? `${v} pzas` : fmt.format(v));
  const parts = segments.filter((s) => s.value > 0);
  const total = parts.reduce((a, s) => a + s.value, 0);
  const max = Math.max(scale || 0, total, marker || 0) || 1;

  let start = 0;
  const placed = parts.map((s) => {
    const p = { ...s, start };
    start += s.value;
    return p;
  });
  const tip = active != null ? placed[active] : null;

  return (
    <div
      className={'sbar sbar-' + size}
      role="group"
      aria-label={placed.map((p) => `${p.label}: ${show(p.value)}`).join(', ') || 'Sin datos'}
      onPointerLeave={() => setActive(null)}
    >
      <div className="sbar-track" style={{ width: pct(total / max) }}>
        {placed.map((p, i) => (
          <span
            key={p.label}
            className={'seg tone-' + p.tone + (active === i ? ' on' : '')}
            style={{ flexGrow: p.value }}
            tabIndex={0}
            aria-label={`${p.label}: ${show(p.value)}`}
            onPointerEnter={() => setActive(i)}
            onClick={() => setActive(active === i ? null : i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
          />
        ))}
      </div>
      {marker != null && <i className="sbar-marker" style={{ left: pct(marker / max) }} aria-hidden="true" />}
      {tip && (
        <div className="sbar-tip" style={{ left: pct(Math.min(Math.max((tip.start + tip.value / 2) / max, 0.15), 0.85)) }}>
          <strong>{show(tip.value)}</strong>
          <span>{tip.label}{total > 0 && placed.length > 1 ? ` · ${Math.round((tip.value / total) * 100)}%` : ''}</span>
        </div>
      )}
    </div>
  );
}
