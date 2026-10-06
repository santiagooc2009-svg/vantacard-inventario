'use client';
import { useEffect, useState } from 'react';
import { startAuthentication, startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { passkeyLoginOptions, passkeyLogin, passkeyRegisterOptions, passkeyRegister } from '@/app/passkeys';

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Otro dispositivo';
}
// Si la persona cancela el Face ID no es un error que haya que mostrar.
const cancelled = (e) => e?.name === 'NotAllowedError' || e?.name === 'AbortError';

function usePasskeyFlow(run) {
  const [state, setState] = useState({ busy: false, error: null, done: false });
  const [supported, setSupported] = useState(true);
  useEffect(() => setSupported(browserSupportsWebAuthn()), []);
  const go = async () => {
    setState({ busy: true, error: null, done: false });
    try {
      await run();
      setState({ busy: false, error: null, done: true });
    } catch (e) {
      setState({ busy: false, error: cancelled(e) ? null : e.message, done: false });
    }
  };
  return { ...state, supported, go };
}

export function PasskeyLogin() {
  const flow = usePasskeyFlow(async () => {
    const { options, error } = await passkeyLoginOptions();
    if (error) throw new Error(error);
    const res = await passkeyLogin(await startAuthentication({ optionsJSON: options }));
    if (res.error) throw new Error(res.error);
    window.location.assign('/');
  });
  if (!flow.supported) return null;
  return (
    <div className="stack">
      <button type="button" className="btn" onClick={flow.go} disabled={flow.busy || flow.done}>
        {flow.busy || flow.done ? 'Entrando…' : 'Entrar con Face ID'}
      </button>
      {flow.error && <p className="hint warn">{flow.error}</p>}
    </div>
  );
}

export function PasskeyRegister() {
  const flow = usePasskeyFlow(async () => {
    const { options, error } = await passkeyRegisterOptions();
    if (error) throw new Error(error);
    const res = await passkeyRegister(await startRegistration({ optionsJSON: options }), deviceName());
    if (res.error) throw new Error(res.error);
  });
  if (!flow.supported) return <p className="hint warn">Este navegador no permite passkeys. En iPhone usa Safari (iOS 16 o más nuevo).</p>;
  return (
    <div className="stack">
      <button type="button" className="btn" onClick={flow.go} disabled={flow.busy}>
        {flow.busy ? 'Activando…' : 'Activar Face ID en este dispositivo'}
      </button>
      {flow.done && <p className="hint pos">✓ Listo. La próxima vez entra con Face ID.</p>}
      {flow.error && <p className="hint warn">{flow.error}</p>}
    </div>
  );
}
