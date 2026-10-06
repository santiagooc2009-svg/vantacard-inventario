import LoginForm from './LoginForm';

export const metadata = { title: 'Entrar · Vantacard' };

export default function LoginPage() {
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
        <LoginForm />
      </div>
    </main>
  );
}
