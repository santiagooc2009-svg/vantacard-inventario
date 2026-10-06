import Link from 'next/link';
import Nav from '@/components/Nav';
import BrandMark from '@/components/BrandMark';
import { logout } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }) {
  return (
    <div className="shell">
      <header className="top">
        <Link href="/" aria-label="Vantacard, inicio">
          <BrandMark />
        </Link>
        <Nav />
        <div className="top-actions">
          <Link href="/cuenta" className="btn-ghost small">Cuenta</Link>
          <form action={logout}>
            <button className="btn-ghost small" type="submit">Salir</button>
          </form>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
