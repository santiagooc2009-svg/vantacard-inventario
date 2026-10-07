import { q } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { deletePasskey } from '@/app/passkeys';
import { PasskeyRegister } from '@/components/PasskeyButton';
import ConfirmButton from '@/components/ConfirmButton';
import { fecha } from '@/lib/format';

export const metadata = { title: 'Cuenta · Vantacard' };

export default async function Cuenta() {
  await ensureSchema();
  const keys = await q(
    `select id, device,
       to_char(created_at at time zone 'America/Mexico_City', 'YYYY-MM-DD') as created,
       to_char(last_used_at at time zone 'America/Mexico_City', 'YYYY-MM-DD') as used
     from passkeys order by created_at`
  );

  return (
    <div className="stack-lg">
      <h1>Cuenta</h1>

      <section className="card">
        <h2>Entrar con Face ID</h2>
        <p className="card-sub">
          Actívalo en el iPhone (o Mac) con el que entras. La llave se guarda en tu llavero de iCloud, así que también sirve en tus otros dispositivos Apple con el mismo Apple ID.
        </p>
        <p className="hint">
          Necesitas tener prendido el Llavero de iCloud: Ajustes → tu nombre → iCloud → Contraseñas y llavero.
        </p>
        {keys.length > 0 ? (
          <ul className="list compact">
            {keys.map((k) => (
              <li key={k.id} className="row">
                <div>
                  <p className="title">{k.device || 'Dispositivo'}</p>
                  <p className="muted small">Activado el {fecha(k.created)}{k.used ? ` · último uso ${fecha(k.used)}` : ''}</p>
                </div>
                <form action={deletePasskey}>
                  <input type="hidden" name="id" value={k.id} />
                  <ConfirmButton message="¿Quitar este dispositivo? Ya no podrá entrar con Face ID.">Quitar</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Todavía no hay dispositivos con Face ID.</p>
        )}
        <div className="top-gap">
          <PasskeyRegister />
        </div>
      </section>

      <section className="card">
        <h2>Contraseña</h2>
        <p className="muted small">
          Sigue funcionando de respaldo (por ejemplo, si cambias de teléfono). Para cambiarla, edita APP_PASSWORD en Vercel y vuelve a desplegar.
        </p>
      </section>
    </div>
  );
}
