import LoginForm from './LoginForm';
import { PasskeyLogin } from '@/components/PasskeyButton';
import { one } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

export const metadata = { title: 'Entrar · Vantacard' };
export const dynamic = 'force-dynamic';

async function hasPasskeys() {
  try {
    await ensureSchema();
    return (await one(`select count(*)::int as n from passkeys`)).n > 0;
  } catch {
    return false;
  }
}

export default async function LoginPage() {
  const faceId = await hasPasskeys();
  return (
    <main className="login">
      <div className="card login-card">
        <div className="brand big">
          <span className="mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M8.5 7a7 7 0 0 1 0 10M12 4.5a10.5 10.5 0 0 1 0 15M5 9.5a3.5 3.5 0 0 1 0 5" /></svg>
          </span>
          Vantacard
        </div>
        <p className="muted">Pedidos, inventario, ventas y finanzas.</p>
        {faceId && (
          <>
            <PasskeyLogin />
            <p className="divider"><span>o con tu contraseña</span></p>
          </>
        )}
        <LoginForm autoFocus={!faceId} secondary={faceId} />
      </div>
    </main>
  );
}
