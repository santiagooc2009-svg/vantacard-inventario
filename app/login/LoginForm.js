'use client';
import { useActionState } from 'react';
import { login } from '@/app/actions';

export default function LoginForm({ autoFocus = true, secondary = false }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="stack">
      <label>
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required autoFocus={autoFocus} />
      </label>
      {state?.error && <p className="hint warn">{state.error}</p>}
      <button className={secondary ? 'btn-soft' : 'btn'} disabled={pending}>{pending ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}
