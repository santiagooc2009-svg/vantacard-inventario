import LoginForm from './LoginForm';
import BrandMark from '@/components/BrandMark';
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
        <BrandMark big />
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
