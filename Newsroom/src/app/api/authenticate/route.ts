import { NextResponse } from 'next/server';

const AUTH_COOKIE_NAME = 'newsroom_auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = body?.password as string | undefined;
  const expectedPassword = process.env.NEWSROOM_PASSWORD;

  if (!expectedPassword) {
    return NextResponse.json(
      { error: 'NEWSROOM_PASSWORD is not configured on the server.' },
      { status: 500 }
    );
  }

  if (!password) {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
  }

  if (password !== expectedPassword) {
    return NextResponse.json({ error: 'Invalid password.' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: 'granted',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
  });
  return response;
}
