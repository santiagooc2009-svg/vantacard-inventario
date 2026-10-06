'use server';

import { revalidatePath } from 'next/cache';
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { q, one } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { relyingParty, saveChallenge, takeChallenge, startSession, hasSession } from '@/lib/passkeys';

// Entrar con Face ID / Touch ID (passkeys). La passkey se guarda en el llavero de iCloud,
// así que sirve en tus dispositivos Apple. La contraseña sigue funcionando de respaldo.

const NO_SESSION = { error: 'Tu sesión expiró. Entra otra vez con tu contraseña.' };
const EXPIRED = { error: 'Se tardó demasiado. Vuelve a intentarlo.' };

// ---------- Registrar este dispositivo (solo con sesión iniciada) ----------

export async function passkeyRegisterOptions() {
  if (!(await hasSession())) return NO_SESSION;
  await ensureSchema();
  const { rpID } = await relyingParty();
  const existing = await q(`select id, transports from passkeys`);
  const options = await generateRegistrationOptions({
    rpName: 'Vantacard',
    rpID,
    userName: 'Vantacard',
    userDisplayName: 'Vantacard',
    userID: new TextEncoder().encode('vantacard'),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.id, transports: c.transports ? c.transports.split(',') : undefined })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  await saveChallenge(options.challenge);
  return { options };
}

export async function passkeyRegister(response, device) {
  if (!(await hasSession())) return NO_SESSION;
  const expectedChallenge = await takeChallenge();
  if (!expectedChallenge) return EXPIRED;
  const { rpID, origin } = await relyingParty();
  let result;
  try {
    result = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID });
  } catch (e) {
    return { error: 'No se pudo activar: ' + e.message };
  }
  if (!result.verified) return { error: 'No se pudo verificar este dispositivo.' };
  const { credential } = result.registrationInfo;
  await q(
    `insert into passkeys (id, public_key, counter, transports, device) values ($1,$2,$3,$4,$5)
     on conflict (id) do nothing`,
    [credential.id, isoBase64URL.fromBuffer(credential.publicKey), credential.counter,
     (credential.transports ?? []).join(',') || null, String(device ?? '').slice(0, 60) || null]
  );
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function deletePasskey(formData) {
  if (!(await hasSession())) return;
  await ensureSchema();
  await q(`delete from passkeys where id = $1`, [String(formData.get('id') ?? '')]);
  revalidatePath('/', 'layout');
}

// ---------- Entrar ----------

export async function passkeyLoginOptions() {
  await ensureSchema();
  const { rpID } = await relyingParty();
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
  await saveChallenge(options.challenge);
  return { options };
}

export async function passkeyLogin(response) {
  if (!process.env.APP_PASSWORD) return { error: 'Falta configurar APP_PASSWORD en Vercel.' };
  const expectedChallenge = await takeChallenge();
  if (!expectedChallenge) return EXPIRED;
  await ensureSchema();
  const cred = await one(`select id, public_key, counter, transports from passkeys where id = $1`, [String(response?.id ?? '')]);
  if (!cred) return { error: 'Esta passkey ya no está registrada. Entra con tu contraseña y vuelve a activar Face ID.' };
  const { rpID, origin } = await relyingParty();
  let result;
  try {
    result = await verifyAuthenticationResponse({
      response, expectedChallenge, expectedOrigin: origin, expectedRPID: rpID,
      credential: {
        id: cred.id,
        publicKey: isoBase64URL.toBuffer(cred.public_key),
        counter: Number(cred.counter),
        transports: cred.transports ? cred.transports.split(',') : undefined,
      },
    });
  } catch (e) {
    return { error: 'No se pudo verificar: ' + e.message };
  }
  if (!result.verified) return { error: 'No se pudo verificar tu identidad.' };
  await q(`update passkeys set counter = $2, last_used_at = now() where id = $1`, [cred.id, result.authenticationInfo.newCounter]);
  await startSession();
  return { ok: true };
}
