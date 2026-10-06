import { getProducts, getAdjustments } from '@/lib/data';
import { createProduct, updateProduct, adjustStock, deleteAdjustment } from '@/app/actions';
import Submit from '@/components/Submit';
import ConfirmButton from '@/components/ConfirmButton';
import { mxn, pct, fecha, today } from '@/lib/format';

export const metadata = { title: 'Inventario · Vantacard' };

export default async function Inventario() {
  const [products, adjustments] = await Promise.all([getProducts({ includeInactive: true }), getAdjustments()]);
  const active = products.filter((p) => p.active);
  const archived = products.filter((p) => !p.active);
  const value = active.reduce((a, p) => a + p.stock_value, 0);
  const units = active.reduce((a, p) => a + Math.max(p.stock, 0), 0);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <h1>Inventario</h1>
        <p className="muted">{units} piezas · costo {mxn(value)}</p>
      </div>

      <ul className="products">
        {active.map((p) => <ProductCard key={p.id} p={p} />)}
      </ul>

      <details className="card">
        <summary><h2>Ajustar existencias</h2></summary>
        <p className="muted small">Para piezas dañadas, que no se pudieron programar, regalos o un conteo físico distinto.</p>
        <p className="hint">Las piezas que sacas se descuentan del pedido más viejo (cuentan como perdidas en su corte). Las que agregas no tienen costo y se usan hasta que se acaban tus pedidos de ese producto.</p>
        <form action={adjustStock} className="stack">
          <label>
            Producto
            <select name="product_id" required>
              <option value="">Elige…</option>
              {active.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.stock} disp.</option>)}
            </select>
          </label>
          <div className="grid-2">
            <label>
              Movimiento
              <select name="direction" defaultValue="out">
                <option value="out">Sacar piezas</option>
                <option value="in">Agregar piezas</option>
              </select>
            </label>
            <label>
              Piezas
              <input name="qty" type="number" min="1" inputMode="numeric" required />
            </label>
          </div>
          <div className="grid-2">
            <label>
              Fecha
              <input type="date" name="date" defaultValue={today()} />
            </label>
            <label>
              Motivo
              <input name="reason" placeholder="Ej. chip defectuoso" />
            </label>
          </div>
          <Submit>Guardar ajuste</Submit>
        </form>
        {adjustments.length > 0 && (
          <ul className="list compact">
            {adjustments.map((a) => (
              <li key={a.id} className="row">
                <div>
                  <p className="small"><strong>{a.qty > 0 ? '+' : ''}{a.qty}</strong> {a.name}</p>
                  <p className="muted small">{fecha(a.date)}{a.reason ? ' · ' + a.reason : ''}</p>
                </div>
                <form action={deleteAdjustment}>
                  <input type="hidden" name="id" value={a.id} />
                  <ConfirmButton message="¿Borrar este ajuste?">Borrar</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="card">
        <summary><h2>Agregar producto</h2></summary>
        <p className="muted small">También puedes crear el producto directo al registrar un pedido.</p>
        <form action={createProduct} className="stack">
          <label>
            Nombre
            <input name="name" required placeholder="Ej. Tarjeta NFC Google dorada" />
          </label>
          <div className="grid-2">
            <label>
              Precio de venta
              <input name="sale_price" type="number" step="0.01" min="0" inputMode="decimal" placeholder="0.00" />
            </label>
            <label>
              Avisarme con
              <input name="min_stock" type="number" min="0" inputMode="numeric" placeholder="Ej. 3" />
            </label>
          </div>
          <label>
            Código (opcional)
            <input name="sku" placeholder="Ej. GOO-NEG" />
          </label>
          <Submit>Agregar</Submit>
        </form>
      </details>

      {archived.length > 0 && (
        <details className="card">
          <summary><h2>Archivados ({archived.length})</h2></summary>
          <ul className="products">
            {archived.map((p) => <ProductCard key={p.id} p={p} />)}
          </ul>
        </details>
      )}
    </div>
  );
}

function ProductCard({ p }) {
  const margin = p.sale_price > 0 ? (p.sale_price - p.unit_cost) / p.sale_price : null;
  const low = p.stock <= p.min_stock && p.received > 0;
  return (
    <li className="card product">
      <div className="product-top">
        <div>
          <p className="title">{p.name}</p>
          <p className="muted small">
            {p.sku ? p.sku + ' · ' : ''}Costo real {mxn(p.unit_cost)} c/u
            {p.in_transit > 0 && <> · <span className="info">{p.in_transit} en camino</span></>}
          </p>
        </div>
        <div className={'stock' + (p.stock <= 0 ? ' out' : low ? ' low' : '')}>
          <strong>{p.stock}</strong>
          <span>pzas</span>
        </div>
      </div>
      <div className="product-stats">
        <div>
          <span className="label">Precio venta</span>
          <strong>{p.sale_price > 0 ? mxn(p.sale_price) : <span className="warn">Sin precio</span>}</strong>
        </div>
        <div>
          <span className="label">Margen</span>
          <strong className={margin == null ? '' : margin >= 0 ? 'pos' : 'neg'}>{margin == null ? '—' : pct(margin)}</strong>
        </div>
        <div>
          <span className="label">Vendidas</span>
          <strong>{p.sold}</strong>
        </div>
      </div>
      <details>
        <summary className="link small">Editar</summary>
        <form action={updateProduct} className="stack top-gap">
          <input type="hidden" name="id" value={p.id} />
          <label>
            Nombre
            <input name="name" defaultValue={p.name} required />
          </label>
          <div className="grid-2">
            <label>
              Precio de venta
              <input name="sale_price" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={p.sale_price || ''} />
            </label>
            <label>
              Avisarme con
              <input name="min_stock" type="number" min="0" inputMode="numeric" defaultValue={p.min_stock || ''} />
            </label>
          </div>
          <div className="grid-2">
            <label>
              Código
              <input name="sku" defaultValue={p.sku ?? ''} />
            </label>
            <label>
              Estado
              <select name="active" defaultValue={p.active ? 'on' : 'off'}>
                <option value="on">Activo</option>
                <option value="off">Archivado</option>
              </select>
            </label>
          </div>
          <label>
            Notas
            <input name="notes" defaultValue={p.notes ?? ''} />
          </label>
          <p className="muted small">
            Recibidas {p.received} · vendidas {p.sold} · ajustes {p.adjusted > 0 ? '+' : ''}{p.adjusted}
          </p>
          <Submit close>Guardar cambios</Submit>
        </form>
      </details>
    </li>
  );
}
