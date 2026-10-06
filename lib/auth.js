// Sesión simple: la cookie guarda un hash de tu contraseña. Si cambias APP_PASSWORD
// en Vercel, todas las sesiones abiertas se cierran solas.
export const COOKIE = 'vc_session';

export async function tokenFor(password) {
  const data = new TextEncoder().encode('vantacard:' + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isValidSession(cookieValue) {
  const pw = process.env.APP_PASSWORD;
  if (!pw || !cookieValue) return false;
  return cookieValue === (await tokenFor(pw));
}
