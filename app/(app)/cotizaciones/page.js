import { getProducts } from '@/lib/data';
import QuoteBuilder from '@/components/QuoteBuilder';

export const metadata = { title: 'Cotizar · Vantacard' };

export default async function Cotizaciones({ searchParams }) {
  const { producto } = await searchParams;
  const products = (await getProducts())
    .filter((p) => p.received > 0 || p.stock > 0 || p.in_transit > 0)
    .map(({ id, name, stock, sale_price, unit_cost, lots, estimate }) => ({ id, name, stock, sale_price, unit_cost, lots, estimate }));

  return (
    <div className="stack-lg">
      <div className="page-head">
        <h1>Cotizar</h1>
        <p className="muted">Elige un producto y pon tu precio por pieza: te armo la tabla de mayoreo para 1, 5, 10, 20 y 50 piezas sin bajar de 50% de ganancia.</p>
      </div>
      <QuoteBuilder products={products} initialId={Number(producto) || null} />
    </div>
  );
}
