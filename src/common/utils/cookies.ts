import { Logger } from '@nestjs/common';
import type { Response } from 'express';

export function sameSite(): 'lax' | 'strict' | 'none' {
  const v = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();
  return v === 'none' ? 'none' : v === 'strict' ? 'strict' : 'lax';
}

function readCookieSecure(): boolean {
  if (typeof process.env.COOKIE_SECURE === 'string') {
    return process.env.COOKIE_SECURE === 'true';
  }
  return process.env.NODE_ENV === 'production';
}

export function cookieBase() {
  const secure = readCookieSecure();
  const ss = sameSite();

  if (ss === 'none' && !secure) {
    Logger.warn(
      'SameSite=None без secure: большинство браузеров отбросит такие cookie. Включите COOKIE_SECURE=true в проде.',
      'cookies.ts',
    );
  }

  return {
    httpOnly: true as const,
    secure,
    sameSite: ss,
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}

export function setRefreshCookie(res: Response, token: string) {
  const base = cookieBase();
  res.cookie('refresh_token', token, {
    ...base,
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function setSidCookie(res: Response, sid: string) {
  const base = cookieBase();
  res.cookie('sid', sid, {
    ...base,
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function setCsrfCookie(res: Response, token: string) {
  const base = cookieBase();
  res.cookie('csrf_token', token, {
    httpOnly: false,
    secure: base.secure,
    sameSite: base.sameSite,
    domain: base.domain,
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  const base = cookieBase();
  res.cookie('refresh_token', '', { ...base, path: '/auth', maxAge: 0 });
  res.cookie('sid', '', { ...base, path: '/auth', maxAge: 0 });
  res.cookie('csrf_token', '', {
    httpOnly: false,
    secure: base.secure,
    sameSite: base.sameSite,
    domain: base.domain,
    path: '/',
    maxAge: 0,
  });
}
