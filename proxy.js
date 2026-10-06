import { NextResponse } from 'next/server';
import { COOKIE, isValidSession } from './lib/auth';

export async function proxy(request) {
  const ok = await isValidSession(request.cookies.get(COOKIE)?.value);
  if (!ok) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)'],
};
