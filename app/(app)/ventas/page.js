import { getProducts, getSales } from '@/lib/data';
import { createSale, deleteSale, toggleSaleStatus } from '@/app/actions';
import { SaleLines } from '@/components/LineItems';
import Submit from '@/components/Submit';
import ConfirmButton from '@/components/ConfirmButton';
import { mxn, fecha, today } from '@/lib/format';

export const metadata = { title: 'Ventas · Vantacard' };

const CHANNELS = ['Instagram', 'WhatsApp', 'Facebook', 'Mercado Libre', 'TikTok', 'En persona', 'Otro'];
const PAYMENTS = ['Transferencia', 'Efectivo', 'Tarjeta', 'Mercado Pago', 'Otro'];

export default async function Ventas() {
  const [products, sales] = await Promise.all([getProducts(), getSales()]);
  const forSale = products.filter((p) => p.received > 0 || p.stock > 0);

  return (
    <div className="stack-lg">
      <h1>Ventas</h1>

      <details className="card" id="nueva" open={sales.length === 0}>
        <summary><h2>Registrar venta</h2></summary>
        <form action={createSale} className="stack">
          <div className="grid-2">
            <label>
              Fecha
              <input type="date" name="date" defaultValue={today()} required />
            </label>
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
          </div>
          <SaleLines products={forSale.length ? forSale : products} />
          <label>
            Estado
            <select name="status" defaultValue="pagada">
              <option value="pagada">Pagada</option>
              <option value="pendiente">Pendiente de cobro</option>
            </select>
          </label>
          <label>
            Notas
            <input name="notes" placeholder="Ej. programada con su link de reseñas" />
          </label>
          <Submit>Guardar venta</Submit>
        </form>
      </details>

      <section className="card">
        <h2>Historial</h2>
        {sales.length === 0 ? (
          <p className="muted">Todavía no hay ventas.</p>
        ) : (
          <ul className="list">
            {sales.map((s) => (
              <li key={s.id}>
                <details className="item">
                  <summary className="row">
                    <div>
                      <p className="title">
                        {s.customer || 'Cliente'}
                        {s.status === 'pendiente' && <span className="tag warn">Por cobrar</span>}
                      </p>
                      <p className="muted small">
                        {fecha(s.date)} · {s.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
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
                            <td className="muted">costo {mxn(i.unit_cost)}</td>
                          </tr>
                        ))}
                        {s.shipping_charged > 0 && <tr><td>Envío cobrado</td><td>{mxn(s.shipping_charged)}</td><td /></tr>}
                        {s.discount > 0 && <tr><td>Descuento</td><td>−{mxn(s.discount)}</td><td /></tr>}
                      </tbody>
                    </table>
                    <p className="muted small">
                      {[s.channel, s.payment_method, s.notes].filter(Boolean).join(' · ')}
                    </p>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
