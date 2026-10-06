import { getMonthly, getExpenses, getProducts, getCortes } from '@/lib/data';
import { createExpense, deleteExpense } from '@/app/actions';
import Submit from '@/components/Submit';
import ConfirmButton from '@/components/ConfirmButton';
import { mxn, mes, fecha, today, pct } from '@/lib/format';
import { corteTitle, dias, plural } from '@/components/Corte';

export const metadata = { title: 'Finanzas · Vantacard' };

const CATEGORIES = ['Envíos a clientes', 'Empaque', 'Publicidad', 'Diseño / impresión', 'Herramientas', 'Comisiones', 'Otros'];

export default async function Finanzas() {
  const [monthly, expenses, products, cortes] = await Promise.all([
    getMonthly(), getExpenses(), getProducts({ includeInactive: true }), getCortes(),
  ]);

  const t = monthly.reduce(
    (a, r) => ({
      revenue: a.revenue + r.revenue, cogs: a.cogs + r.cogs, expenses: a.expenses + r.expenses,
      spend: a.spend + r.inventory_spend,
    }),
    { revenue: 0, cogs: 0, expenses: 0, spend: 0 }
  );
  const profit = t.revenue - t.cogs - t.expenses;
  const cash = t.revenue - t.spend - t.expenses;
  const sold = products.filter((p) => p.sold > 0).sort((a, b) => b.revenue - b.cogs - (a.revenue - a.cogs));

  const closed = cortes.closed;
  const ct = closed.reduce(
    (a, c) => ({ cost: a.cost + c.cost, revenue: a.revenue + c.revenue, days: a.days + c.days, sold: a.sold + c.sold, lost: a.lost + c.lost }),
    { cost: 0, revenue: 0, days: 0, sold: 0, lost: 0 }
  );

  return (
    <div className="stack-lg">
      <h1>Finanzas</h1>

      <section className="kpis">
        <div className="kpi">
          <p className="label">Utilidad total</p>
          <p className={'num ' + (profit >= 0 ? 'pos' : 'neg')}>{mxn(profit)}</p>
          <p className="sub">ventas − costo de lo vendido − gastos</p>
        </div>
        <div className="kpi">
          <p className="label">Dinero recuperado</p>
          <p className={'num ' + (cash >= 0 ? 'pos' : 'neg')}>{mxn(cash)}</p>
          <p className="sub">ventas − todo lo que has gastado</p>
        </div>
      </section>

      <section className="card">
        <h2>Por mes</h2>
        {monthly.length === 0 ? (
          <p className="muted">Sin movimientos todavía.</p>
        ) : (
          <div className="months">
            {monthly.map((r) => {
              const p = r.revenue - r.cogs - r.expenses;
              return (
                <div key={r.month} className="month">
                  <div className="month-head">
                    <strong>{mes(r.month)}</strong>
                    <strong className={p >= 0 ? 'pos' : 'neg'}>{mxn(p)}</strong>
                  </div>
                  <dl>
                    <dt>Ventas ({r.units} pzas)</dt><dd>{mxn(r.revenue)}</dd>
                    <dt>Costo de lo vendido</dt><dd>−{mxn(r.cogs)}</dd>
                    <dt>Gastos</dt><dd>−{mxn(r.expenses)}</dd>
                    <dt className="muted">Compras de inventario</dt><dd className="muted">{mxn(r.inventory_spend)}</dd>
                  </dl>
                </div>
              );
            })}
          </div>
        )}
        <p className="hint">
          La utilidad solo cuenta el costo de las piezas que ya vendiste. Lo que compraste y sigue en inventario no es pérdida: es mercancía.
        </p>
      </section>

      <section className="card">
        <h2>Cortes cerrados</h2>
        {closed.length === 0 ? (
          <p className="muted">
            Todavía no se acaba ningún pedido. Cada pedido recibido es un corte y se cierra solo cuando vendes o das de baja todas sus piezas.
          </p>
        ) : (
          <div className="stack">
            <div className="month">
              <dl className="facts">
                <dt>{closed.length === 1 ? '1 corte cerrado' : `${closed.length} cortes cerrados`}</dt><dd>{plural(ct.sold, 'vendida')}{ct.lost > 0 ? ` · ${plural(ct.lost, 'perdida')}` : ''}</dd>
                <dt>Te costaron</dt><dd>{mxn(ct.cost)}</dd>
                <dt>Vendiste</dt><dd>{mxn(ct.revenue)}</dd>
                <dt>Ganancia</dt><dd className={ct.revenue - ct.cost >= 0 ? 'pos' : 'neg'}><strong>{mxn(ct.revenue - ct.cost)}</strong></dd>
                <dt>Recuperado</dt><dd>{ct.cost > 0 ? pct(ct.revenue / ct.cost) : '—'}</dd>
                <dt>Se acaban en promedio en</dt><dd>{dias(Math.round(ct.days / closed.length))}</dd>
              </dl>
            </div>
            <ul className="list compact">
              {closed.map((c) => (
                <li key={c.id} className="row">
                  <div>
                    <p className="title">{corteTitle(c)}</p>
                    <p className="muted small">
                      {fecha(c.date)} → {fecha(c.endedOn)} · {dias(c.days)} · {plural(c.sold, 'vendida')}{c.lost > 0 ? ` · ${plural(c.lost, 'perdida')}` : ''}
                    </p>
                    <p className="muted small">Costó {mxn(c.cost)} · vendiste {mxn(c.revenue)}</p>
                  </div>
                  <div className="right">
                    <p className={'title ' + (c.profit >= 0 ? 'pos' : 'neg')}>{mxn(c.profit)}</p>
                    {c.recovered != null && <p className="muted small">{pct(c.recovered)} recuperado</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="hint">
          Ganancia de un corte = lo que vendiste de sus piezas (con envío y descuento) − lo que pagaste por el pedido. Las piezas perdidas ya van dentro de ese costo.
        </p>
      </section>

      {sold.length > 0 && (
        <section className="card">
          <h2>Qué producto deja más</h2>
          <ul className="list compact">
            {sold.map((p) => {
              const g = p.revenue - p.cogs;
              return (
                <li key={p.id} className="row">
                  <div>
                    <p className="title">{p.name}</p>
                    <p className="muted small">{p.sold} vendidas · {mxn(p.revenue)} · margen {pct(p.revenue ? g / p.revenue : 0)}</p>
                  </div>
                  <p className={'title ' + (g >= 0 ? 'pos' : 'neg')}>{mxn(g)}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <details className="card" id="gasto" open={expenses.length === 0}>
        <summary><h2>Registrar gasto</h2></summary>
        <p className="muted small">Todo lo que no es mercancía: envíos que pagas tú, bolsitas, anuncios, etc.</p>
        <form action={createExpense} className="stack">
          <div className="grid-2">
            <label>
              Fecha
              <input type="date" name="date" defaultValue={today()} required />
            </label>
            <label>
              Monto
              <input name="amount" type="number" step="0.01" min="0.01" inputMode="decimal" required placeholder="0.00" />
            </label>
          </div>
          <label>
            Categoría
            <select name="category" defaultValue="Envíos a clientes">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>
            Descripción
            <input name="description" placeholder="Ej. guía Estafeta para cliente de Puebla" />
          </label>
          <Submit>Guardar gasto</Submit>
        </form>
      </details>

      {expenses.length > 0 && (
        <section className="card">
          <h2>Gastos</h2>
          <ul className="list compact">
            {expenses.map((e) => (
              <li key={e.id} className="row">
                <div>
                  <p className="title">{e.category}</p>
                  <p className="muted small">{fecha(e.date)}{e.description ? ' · ' + e.description : ''}</p>
                </div>
                <div className="right row-actions">
                  <p className="title">{mxn(e.amount)}</p>
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={e.id} />
                    <ConfirmButton message="¿Borrar este gasto?">Borrar</ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
