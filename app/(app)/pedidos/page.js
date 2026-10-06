import { getProducts, getPurchases } from '@/lib/data';
import { createPurchase, updatePurchase, deletePurchase } from '@/app/actions';
import { PurchaseLines } from '@/components/LineItems';
import Submit from '@/components/Submit';
import ConfirmButton from '@/components/ConfirmButton';
import { mxn, fecha, today } from '@/lib/format';

export const metadata = { title: 'Pedidos · Vantacard' };

const STATUS = {
  en_camino: { label: 'En camino', cls: 'info' },
  recibido: { label: 'Recibido', cls: 'ok' },
  cancelado: { label: 'Cancelado / no llegó', cls: 'muted-tag' },
};

export default async function Pedidos() {
  const [products, purchases] = await Promise.all([getProducts({ includeInactive: true }), getPurchases()]);
  const paid = purchases.reduce((a, p) => a + p.total_paid, 0);
  const refunds = purchases.reduce((a, p) => a + p.refund, 0);

  return (
    <div className="stack-lg">
      <div className="page-head">
        <h1>Pedidos a proveedores</h1>
        <p className="muted">Pagado {mxn(paid)} · reembolsado {mxn(refunds)} · neto {mxn(paid - refunds)}</p>
      </div>

      <details className="card" id="nuevo">
        <summary><h2>Registrar pedido</h2></summary>
        <form action={createPurchase} className="stack">
          <div className="grid-2">
            <label>
              Fecha
              <input type="date" name="date" defaultValue={today()} required />
            </label>
            <label>
              Plataforma
              <select name="platform" defaultValue="AliExpress">
                <option>AliExpress</option>
                <option>Alibaba</option>
                <option>Temu</option>
                <option>Mercado Libre</option>
                <option>Otro</option>
              </select>
            </label>
          </div>
          <label>
            Tienda / proveedor
            <input name="supplier" required placeholder="Ej. HaiNuo Store" />
          </label>
          <PurchaseLines products={products} />
          <div className="grid-2">
            <label>
              Total que pagaste
              <input name="total_paid" type="number" step="0.01" min="0" inputMode="decimal" required placeholder="0.00" />
            </label>
            <label>
              Estado
              <select name="status" defaultValue="en_camino">
                <option value="en_camino">En camino</option>
                <option value="recibido">Ya llegó</option>
              </select>
            </label>
          </div>
          <p className="hint">Pon el total cobrado a tu tarjeta (con envío y comisiones). Así el costo por pieza es el real.</p>
          <label>
            Núm. de pedido (opcional)
            <input name="order_number" inputMode="numeric" />
          </label>
          <label>
            Notas
            <input name="notes" />
          </label>
          <Submit>Guardar pedido</Submit>
        </form>
      </details>

      <ul className="list">
        {purchases.map((p) => {
          const net = p.total_paid - p.refund;
          const units = p.items.reduce((a, i) => a + i.units, 0);
          const st = STATUS[p.status] ?? STATUS.en_camino;
          return (
            <li key={p.id} className="card">
              <details className="item">
                <summary className="row">
                  <div>
                    <p className="title">{p.supplier} <span className={'tag ' + st.cls}>{st.label}</span></p>
                    <p className="muted small">
                      {fecha(p.date)} · {p.platform} · {p.items.map((i) => `${i.units} ${i.name}`).join(', ')}
                    </p>
                  </div>
                  <div className="right">
                    <p className="title">{mxn(net)}</p>
                    {p.refund > 0 && <p className="small pos">−{mxn(p.refund)} reemb.</p>}
                    {p.status !== 'cancelado' && units > 0 && <p className="muted small">{mxn(net / units)} c/u</p>}
                  </div>
                </summary>
                <div className="item-body">
                  {p.notes && <p className="muted small">{p.notes}</p>}
                  {p.order_number && <p className="muted small">Pedido #{p.order_number}</p>}
                  {p.items.length > 1 && (
                    <table className="mini">
                      <tbody>
                        {p.items.map((i) => (
                          <tr key={i.id}><td>{i.units}× {i.name}</td><td>{mxn(i.cost / i.units)} c/u</td></tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <form action={updatePurchase} className="stack">
                    <input type="hidden" name="id" value={p.id} />
                    <div className="grid-2">
                      <label>
                        Estado
                        <select name="status" defaultValue={p.status}>
                          <option value="en_camino">En camino</option>
                          <option value="recibido">Recibido</option>
                          <option value="cancelado">Cancelado / no llegó</option>
                        </select>
                      </label>
                      <label>
                        Fecha
                        <input type="date" name="date" defaultValue={p.date} />
                      </label>
                      <label>
                        Total pagado
                        <input name="total_paid" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={p.total_paid} />
                      </label>
                      <label>
                        Reembolso
                        <input name="refund" type="number" step="0.01" min="0" inputMode="decimal" defaultValue={p.refund || ''} placeholder="0.00" />
                      </label>
                    </div>
                    <label>
                      Notas
                      <input name="notes" defaultValue={p.notes ?? ''} />
                    </label>
                    <div className="actions">
                      <Submit className="btn small">Guardar</Submit>
                    </div>
                  </form>
                  <form action={deletePurchase} className="actions">
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmButton message="¿Borrar este pedido? Sus piezas salen del inventario.">Borrar pedido</ConfirmButton>
                  </form>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
