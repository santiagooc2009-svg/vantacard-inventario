'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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

function errorText(e) {
  if (e?.name === 'NotAllowedError') return 'No se completó Face ID (se canceló o el teléfono no lo permitió). Vuelve a tocar el botón.';
  if (e?.name === 'InvalidStateError') return 'Este dispositivo ya tiene Face ID activado para la app.';
  return e?.message || 'Algo falló. Vuelve a intentarlo.';
}

// Safari (iPhone) solo abre Face ID si se llama en el mismo instante en que tocas el botón.
// Por eso el reto del servidor se pide antes, al abrir la página (y se renueva antes de que
// venza a los 5 minutos), y el toque llama a Face ID sin esperar nada.
function usePasskey(getOptions, run) {
  const options = useRef(null);
  const [state, setState] = useState({ ready: false, busy: false, done: false, error: null });
  const [supported, setSupported] = useState(true);

  const load = useCallback(async () => {
    options.current = null;
    setState((s) => ({ ...s, ready: false }));
    try {
      const res = await getOptions();
      if (res.error) return setState((s) => ({ ...s, error: res.error }));
      options.current = res.options;
      setState((s) => ({ ...s, ready: true }));
    } catch (e) {
      setState((s) => ({ ...s, error: 'No se pudo preparar Face ID: ' + errorText(e) }));
    }
  }, [getOptions]);

  useEffect(() => {
    const ok = browserSupportsWebAuthn();
    setSupported(ok);
    if (!ok) return;
    load();
    const timer = setInterval(load, 4 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load]);

  const go = () => {
    const opts = options.current;
    if (!opts) return;
    options.current = null; // cada reto sirve una sola vez
    setState({ ready: false, busy: true, done: false, error: null });
    // run() llama a Face ID en su primera línea, todavía dentro del toque.
    run(opts)
      .then(() => setState({ ready: false, busy: false, done: true, error: null }))
      .catch((e) => setState({ ready: false, busy: false, done: false, error: errorText(e) }))
      .finally(load);
  };

  return { ...state, supported, go };
}

export function PasskeyLogin() {
  const flow = usePasskey(passkeyLoginOptions, async (optionsJSON) => {
    const response = await startAuthentication({ optionsJSON });
    const res = await passkeyLogin(response);
    if (res.error) throw new Error(res.error);
    window.location.assign('/');
  });
  if (!flow.supported) return null;
  return (
    <div className="stack">
      <button type="button" className="btn" onClick={flow.go} disabled={!flow.ready || flow.busy || flow.done}>
        {flow.busy || flow.done ? 'Entrando…' : flow.ready ? 'Entrar con Face ID' : 'Preparando Face ID…'}
      </button>
      {flow.error && <p className="hint warn">{flow.error}</p>}
    </div>
  );
}

export function PasskeyRegister() {
  const flow = usePasskey(passkeyRegisterOptions, async (optionsJSON) => {
    const response = await startRegistration({ optionsJSON });
    const res = await passkeyRegister(response, deviceName());
    if (res.error) throw new Error(res.error);
  });
  if (!flow.supported) return <p className="hint warn">Este navegador no permite passkeys. En iPhone usa Safari (iOS 16 o más nuevo).</p>;
  return (
    <div className="stack">
      <button type="button" className="btn" onClick={flow.go} disabled={!flow.ready || flow.busy}>
        {flow.busy ? 'Activando…' : flow.ready ? 'Activar Face ID en este dispositivo' : 'Preparando Face ID…'}
      </button>
      {flow.done && <p className="hint pos">✓ Listo. La próxima vez entra con Face ID.</p>}
      {flow.error && <p className="hint warn">{flow.error}</p>}
    </div>
  );
}
