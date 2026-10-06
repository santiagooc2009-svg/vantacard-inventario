'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Inicio', icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { href: '/ventas', label: 'Ventas', icon: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 8H6.2M9 20.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z' },
  { href: '/inventario', label: 'Inventario', icon: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8' },
  { href: '/pedidos', label: 'Pedidos', icon: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z' },
  { href: '/finanzas', label: 'Finanzas', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Secciones">
      {LINKS.map((l) => {
        const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={active ? 'nav-link active' : 'nav-link'}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={l.icon} /></svg>
            <span>{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
