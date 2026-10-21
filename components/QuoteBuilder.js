'use client';
import { useMemo, useState } from 'react';
import { buildQuote, fifoCost, MIN_MARGIN } from '@/lib/pricing';
import { setSalePrice } from '@/app/actions';

const fmt2 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const fmt0 = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
// Precios redondos sin centavos ($150); con centavos solo si los tiene.
const money = (n) => (Math.abs(n % 1) < 0.005 ? fmt0 : fmt2).format(n);
const pct = (n) => `${Math.round(n * 100)}%`;
const pzas = (n) => (n === 1 ? '1 pza' : `${n} pzas`);

export default function QuoteBuilder({ products, initialId }) {
  const first = products.find((p) => p.id === initialId) ?? products[0];
  const [id, setId] = useState(first ? String(first.id) : '');
  const [price, setPrice] = useState(first?.sale_price ? String(first.sale_price) : '');
  const [ask, setAsk] = useState({ qty: '', price: '' });
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const p = products.find((x) => String(x.id) === id);
  const unit = parseFloat(price) || 0;
  const quote = useMemo(() => (p && unit > 0 ? buildQuote(p, unit) : null), [p, unit]);

  if (!products.length) return <p className="muted">Primero registra un pedido para tener productos que cotizar.</p>;

  const pick = (value) => {
    setId(value);
    const np = products.find((x) => String(x.id) === value);
    setPrice(np?.sale_price ? String(np.sale_price) : '');
    setAsk({ qty: '', price: '' });
    setSaved(false);
  };

  const text = quote
    ? [`*${p.name}*`, ...quote.rows.map((r) => `${pzas(r.qty)}: ${money(r.price)} c/u${r.qty > 1 ? ` (total ${money(r.total)})` : ''}`), 'Precios en MXN.'].join('\n')
    : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // Calculadora para negociar: lo que te piden contra tu mínimo.
  const askQty = parseInt(ask.qty) || 0;
  const askPrice = parseFloat(ask.price) || 0;
  const askCost = p && askQty > 0 ? fifoCost(p, 0, askQty) / askQty : 0;
  const askFloor = Math.ceil(askCost / (1 - MIN_MARGIN));
  const askMargin = askPrice > 0 ? (askPrice - askCost) / askPrice : 0;

  return (
    <div className="stack-lg">
      <section className="card stack">
        <label>
          Producto
          <select value={id} onChange={(e) => pick(e.target.value)}>
            {products.map((x) => (
              <option key={x.id} value={x.id}>{x.name} · {x.stock} disp.</option>
            ))}
          </select>
        </label>
        <label>
          Tu precio por pieza (el de lista, para negociar)
          <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="Ej. 150" value={price} onChange={(e) => { setPrice(e.target.value); setSaved(false); }} />
        </label>
        {p && (
          <p className="muted small">
            Costo real {fmt2.format(p.unit_cost)} c/u · tienes {pzas(Math.max(p.stock, 0))}
            {quote && <> · piso para 1 pza (50% de ganancia): <strong>{money(quote.floor)}</strong></>}
          </p>
        )}
        {quote?.tooLow && (
          <p className="hint warn">
            Con {money(unit)} por pieza no llegas a tu 50% de ganancia: sube tu precio arriba de {money(quote.rows.at(-1).floor)} para tener margen de mayoreo.
          </p>
        )}
        {p && unit > 0 && unit !== p.sale_price && (
          <button
            type="button"
            className="btn-ghost small"
            onClick={async () => { await setSalePrice(p.id, unit); setSaved(true); }}
          >
            {saved ? '✓ Guardado como precio de venta' : `Guardar ${money(unit)} como precio de venta de este producto`}
          </button>
        )}
      </section>

      {quote && (
        <section className="card">
          <div className="card-head">
            <h2>Tabla de mayoreo</h2>
            <span className="label">mín. 50%</span>
          </div>
          <p className="card-sub">De tu precio baja en partes iguales hasta 50 piezas, donde queda justo en tu mínimo de 50% de ganancia.</p>
          <ul className="quote">
            {quote.rows.map((r) => (
              <li key={r.qty} className={r.margin < MIN_MARGIN - 0.0005 ? 'low' : ''}>
                <div className="quote-main">
                  <span className="quote-qty">{pzas(r.qty)}</span>
                  <span className="quote-price">{money(r.price)}<small> c/u</small></span>
                  <span className="quote-total">{money(r.total)}</span>
                </div>
                <div className="quote-meta">
                  <span className={r.margin >= MIN_MARGIN - 0.0005 ? 'pos' : 'neg'}>ganas {fmt2.format(r.profit)} · {pct(r.margin)}</span>
                  <span className="muted">{r.room > 0 ? `puedes bajar hasta ${money(r.floor)}` : `piso ${money(r.floor)}`}</span>
                </div>
                {r.short > 0 && <p className="hint warn">Te faltan {pzas(r.short)} en inventario (su costo es estimado).</p>}
              </li>
            ))}
          </ul>
          <div className="actions top-gap">
            <button type="button" className="btn small" onClick={copy}>{copied ? '✓ Copiada' : 'Copiar cotización'}</button>
            <a className="btn-soft small" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener">Mandar por WhatsApp</a>
          </div>
        </section>
      )}

      {p && (
        <section className="card stack">
          <h2>Negociar</h2>
          <p className="card-sub">¿Te piden otro precio? Ponlo aquí y te digo si te conviene.</p>
          <div className="grid-2">
            <label>
              Piezas
              <input type="number" min="1" inputMode="numeric" placeholder="Ej. 30" value={ask.qty} onChange={(e) => setAsk({ ...ask, qty: e.target.value })} />
            </label>
            <label>
              Precio c/u que te piden
              <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="Ej. 70" value={ask.price} onChange={(e) => setAsk({ ...ask, price: e.target.value })} />
            </label>
          </div>
          {askQty > 0 && askPrice > 0 && (
            <div className={'verdict ' + (askMargin >= MIN_MARGIN - 0.0005 ? 'ok' : 'no')}>
              <p className="title">{askMargin >= MIN_MARGIN - 0.0005 ? '✓ Te conviene' : '✗ Debajo de tu mínimo'}</p>
              <p className="small">
                {pzas(askQty)} a {money(askPrice)} = {money(askQty * askPrice)} · ganas {fmt2.format((askPrice - askCost) * askQty)} ({pct(askMargin)})
              </p>
              <p className="small muted">Lo menos que puedes dar por {pzas(askQty)} es {money(askFloor)} c/u.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
