import Link from 'next/link';
import Nav from '@/components/Nav';
import { logout } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }) {
  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M8.5 7a7 7 0 0 1 0 10M12 4.5a10.5 10.5 0 0 1 0 15M5 9.5a3.5 3.5 0 0 1 0 5" /></svg>
          </span>
          Vantacard
        </div>
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
