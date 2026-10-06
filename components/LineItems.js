'use client';
import { useEffect, useRef, useState } from 'react';

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

function useFormReset(ref, onReset) {
  useEffect(() => {
    const form = ref.current?.closest('form');
    if (!form) return;
    form.addEventListener('reset', onReset);
    return () => form.removeEventListener('reset', onReset);
  });
}

// ---------- Líneas de una venta ----------

const emptySale = () => ({ key: Math.random(), product_id: '', qty: '1', price: '' });

export function SaleLines({ products }) {
  const ref = useRef(null);
  const [rows, setRows] = useState([emptySale()]);
  const [extra, setExtra] = useState({ shipping: '', discount: '' });
  useFormReset(ref, () => { setRows([emptySale()]); setExtra({ shipping: '', discount: '' }); });

  const byId = Object.fromEntries(products.map((p) => [String(p.id), p]));
  const set = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const goods = rows.reduce((a, r) => a + (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0), 0);
  const cost = rows.reduce((a, r) => a + (parseFloat(r.qty) || 0) * (byId[r.product_id]?.avg_cost || 0), 0);
  const total = goods + (parseFloat(extra.shipping) || 0) - (parseFloat(extra.discount) || 0);

  return (
    <div ref={ref} className="lines">
      {rows.map((r, i) => {
        const p = byId[r.product_id];
        const qty = parseInt(r.qty) || 0;
        const short = p && qty > p.stock;
        return (
          <div className="line" key={r.key}>
            <label className="span-2">
              Producto
              <select
                name="product_id"
                value={r.product_id}
                required={i === 0}
                onChange={(e) => {
                  const np = byId[e.target.value];
                  set(i, { product_id: e.target.value, price: np && np.sale_price ? String(np.sale_price) : r.price });
                }}
              >
                <option value="">Elige…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.stock} disp.
                  </option>
                ))}
              </select>
            </label>
            <label>
              Piezas
              <input name="qty" type="number" min="1" inputMode="numeric" value={r.qty} onChange={(e) => set(i, { qty: e.target.value })} />
            </label>
            <label>
              Precio c/u
              <input name="price" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={r.price} onChange={(e) => set(i, { price: e.target.value })} />
            </label>
            {short && <p className="hint warn span-2">Solo tienes {p.stock} en inventario.</p>}
            {rows.length > 1 && (
              <button type="button" className="btn-ghost danger span-2" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                Quitar producto
              </button>
            )}
          </div>
        );
      })}
      <button type="button" className="btn-ghost" onClick={() => setRows((r) => [...r, emptySale()])}>
        + Agregar otro producto
      </button>
      <div className="grid-2">
        <label>
          Envío cobrado
          <input name="shipping_charged" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={extra.shipping} onChange={(e) => setExtra({ ...extra, shipping: e.target.value })} />
        </label>
        <label>
          Descuento
          <input name="discount" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={extra.discount} onChange={(e) => setExtra({ ...extra, discount: e.target.value })} />
        </label>
      </div>
      <div className="totals">
        <div><span>Total de la venta</span><strong>{fmt.format(total)}</strong></div>
        <div><span>Ganancia estimada</span><strong className={total - cost >= 0 ? 'pos' : 'neg'}>{fmt.format(total - cost)}</strong></div>
      </div>
    </div>
  );
}

// ---------- Líneas de un pedido a proveedor ----------

const emptyPurchase = () => ({ key: Math.random(), product_id: '', new_name: '', units: '', subtotal: '' });

export function PurchaseLines({ products }) {
  const ref = useRef(null);
  const [rows, setRows] = useState([emptyPurchase()]);
  useFormReset(ref, () => setRows([emptyPurchase()]));
  const set = (i, patch) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  return (
    <div ref={ref} className="lines">
      {rows.map((r, i) => (
        <div className="line" key={r.key}>
          <label className="span-2">
            Producto
            <select name="product_id" value={r.product_id} required={i === 0} onChange={(e) => set(i, { product_id: e.target.value })}>
              <option value="">Elige…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              <option value="new">+ Producto nuevo…</option>
            </select>
          </label>
          <label className="span-2" hidden={r.product_id !== 'new'}>
            Nombre del producto nuevo
            <input name="new_name" value={r.new_name} required={r.product_id === 'new'} placeholder="Ej. Tarjeta NFC Google dorada" onChange={(e) => set(i, { new_name: e.target.value })} />
          </label>
          <label>
            Piezas totales
            <input name="units" type="number" min="1" inputMode="numeric" required={i === 0} placeholder="Ej. 15" value={r.units} onChange={(e) => set(i, { units: e.target.value })} />
          </label>
          <label>
            Precio en la página
            <input name="subtotal" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" value={r.subtotal} onChange={(e) => set(i, { subtotal: e.target.value })} />
          </label>
          {rows.length > 1 && (
            <button type="button" className="btn-ghost danger span-2" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
              Quitar producto
            </button>
          )}
        </div>
      ))}
      <p className="hint">
        Piezas totales = paquetes × piezas por paquete (3 paquetes de 5 = 15). El precio en la página solo sirve para repartir el costo si el pedido trae varios productos.
      </p>
      <button type="button" className="btn-ghost" onClick={() => setRows((r) => [...r, emptyPurchase()])}>
        + Agregar otro producto al pedido
      </button>
    </div>
  );
}
