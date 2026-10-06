import { getProducts, getSales, getCortes } from '@/lib/data';
import { createSale, deleteSale, toggleSaleStatus, markDelivered } from '@/app/actions';
import { SaleLines } from '@/components/LineItems';
import DeliveryFields from '@/components/DeliveryFields';
import Submit from '@/components/Submit';
import ConfirmButton from '@/components/ConfirmButton';
import { mxn, fecha, today, diaEntrega } from '@/lib/format';

export const metadata = { title: 'Ventas · Vantacard' };

const CHANNELS = ['Instagram', 'WhatsApp', 'Facebook', 'Mercado Libre', 'TikTok', 'En persona', 'Otro'];
const PAYMENTS = ['Transferencia', 'Efectivo', 'Tarjeta', 'Mercado Pago', 'Otro'];

export default async function Ventas() {
  const [products, sales, { estimated }] = await Promise.all([getProducts(), getSales(), getCortes()]);
  const forSale = products.filter((p) => p.received > 0 || p.stock > 0);
  const now = today();

  // Por entregar: la más próxima primero. Ya entregadas: la más reciente primero.
  const toDeliver = sales.filter((s) => !s.delivered).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  const delivered = sales.filter((s) => s.delivered);
  const toDeliverTotal = toDeliver.reduce((a, s) => a + s.total, 0);

  return (
    <div className="stack-lg">
      <h1>Ventas</h1>

      <details className="card" id="nueva" open={sales.length === 0}>
        <summary><h2>Registrar venta</h2></summary>
        <form action={createSale} className="stack">
          <div className="grid-2">
            <DeliveryFields today={now} />
            <label>
              Cliente
              <input name="customer" placeholder="Nombre o negocio" />
            </label>
            <label>
              Canal
              <select name="channel" defaultValue="Instagram">
                {CHANNELS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Pago
              <select name="payment_method" defaultValue="Transferencia">
                {PAYMENTS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label>
              Cobro
              <select name="status" defaultValue="pagada">
                <option value="pagada">Pagada</option>
                <option value="pendiente">Por cobrar</option>
              </select>
            </label>
          </div>
          <p className="hint">Si la vas a entregar otro día, elige “Por entregar”: las piezas se apartan, pero no cuenta como venta hasta que la marques como entregada.</p>
          <SaleLines products={forSale.length ? forSale : products} />
          <label>
            Notas
            <input name="notes" placeholder="Ej. programada con su link de reseñas" />
          </label>
          <Submit>Guardar venta</Submit>
        </form>
      </details>

      {toDeliver.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Por entregar</h2>
            <span className="muted small">{mxn(toDeliverTotal)}</span>
          </div>
          <p className="card-sub">Las piezas ya están apartadas. Cuentan como venta cuando las marques como entregadas.</p>
          <ul className="list">
            {toDeliver.map((s) => {
              const late = s.date < now;
              return (
                <li key={s.id}>
                  <SaleItem
                    s={s}
                    estimated={estimated}
                    tag={late ? <span className="tag neg-tag">Atrasada</span> : s.date === now ? <span className="tag warn">Hoy</span> : null}
                    when={late ? `Era para el ${diaEntrega(s.date)}` : `Entrega ${diaEntrega(s.date)}`}
                    deliver={now}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Historial</h2>
        {delivered.length === 0 ? (
          <p className="muted">Todavía no hay ventas entregadas.</p>
        ) : (
          <ul className="list">
            {delivered.map((s) => (
              <li key={s.id}>
                <SaleItem s={s} estimated={estimated} when={fecha(s.date)} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SaleItem({ s, estimated, tag, when, deliver }) {
  return (
    <details className="item">
      <summary className="row">
        <div>
          <p className="title">
            {s.customer || 'Cliente'}
            {tag}
            {s.status === 'pendiente' && <span className="tag warn">Por cobrar</span>}
          </p>
          <p className="muted small">
            {when} · {s.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
          </p>
        </div>
        <div className="right">
          <p className="title">{mxn(s.total)}</p>
          <p className={'small ' + (s.profit >= 0 ? 'pos' : 'neg')}>Ganancia {mxn(s.profit)}</p>
        </div>
      </summary>
      <div className="item-body">
        <table className="mini">
          <tbody>
            {s.items.map((i, k) => (
              <tr key={k}>
                <td>{i.qty}× {i.name}</td>
                <td>{mxn(i.unit_price)} c/u</td>
                <td className="muted">{estimated.has(i.id) ? 'costo estimado' : 'costo'} {mxn(i.unit_cost)}</td>
              </tr>
            ))}
            {s.shipping_charged > 0 && <tr><td>Envío cobrado</td><td>{mxn(s.shipping_charged)}</td><td /></tr>}
            {s.discount > 0 && <tr><td>Descuento</td><td>−{mxn(s.discount)}</td><td /></tr>}
          </tbody>
        </table>
        <p className="muted small">
          {[s.channel, s.payment_method, s.notes].filter(Boolean).join(' · ')}
        </p>
        {deliver && (
          <form action={markDelivered} className="deliver-form">
            <input type="hidden" name="id" value={s.id} />
            <label>
              Entregada el
              <input type="date" name="date" defaultValue={deliver} max={deliver} required />
            </label>
            <Submit className="btn small">Marcar entregada</Submit>
          </form>
        )}
        <div className="actions">
          <form action={toggleSaleStatus}>
            <input type="hidden" name="id" value={s.id} />
            <button className="btn-soft small">
              {s.status === 'pagada' ? 'Marcar por cobrar' : 'Marcar como pagada'}
            </button>
          </form>
          <form action={deleteSale}>
            <input type="hidden" name="id" value={s.id} />
            <ConfirmButton message="¿Borrar esta venta? Las piezas regresan al inventario.">Borrar</ConfirmButton>
          </form>
        </div>
      </div>
    </details>
  );
}
