import { cookies, headers } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { COOKIE, tokenFor, isValidSession } from './auth';

// Utilidades del servidor para entrar con passkey (Face ID / Touch ID).

const CHALLENGE = 'vc_challenge';
const secure = process.env.NODE_ENV === 'production';

// El dominio de la app tal como lo ve el teléfono: las passkeys quedan ligadas a él.
export async function relyingParty() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return { rpID: host.split(':')[0], origin: `${proto}://${host}` };
}

const sign = (payload) =>
  createHmac('sha256', 'vantacard-passkey:' + (process.env.APP_PASSWORD ?? '')).update(payload).digest('base64url');

// El reto va en una cookie firmada que vence en 5 minutos y solo sirve una vez.
export async function saveChallenge(challenge) {
  const payload = `${challenge}.${Date.now() + 5 * 60 * 1000}`;
  (await cookies()).set(CHALLENGE, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 300,
  });
}

export async function takeChallenge() {
  const jar = await cookies();
  const value = jar.get(CHALLENGE)?.value;
  jar.delete(CHALLENGE);
  if (!value) return null;
  const [challenge, exp, sig] = value.split('.');
  const expected = Buffer.from(sign(`${challenge}.${exp}`));
  const got = Buffer.from(sig ?? '');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  if (Date.now() > Number(exp)) return null;
  return challenge;
}

// La misma sesión que da la contraseña (60 días).
export async function startSession() {
  (await cookies()).set(COOKIE, await tokenFor(process.env.APP_PASSWORD), {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 60,
  });
}

export async function hasSession() {
  return isValidSession((await cookies()).get(COOKIE)?.value);
}
