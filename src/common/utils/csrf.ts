import { BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { setCsrfCookie } from './cookies';
import { getAllowedOrigins } from './origin';

export function assertCsrfAndOrigin(req: Request) {
  const csrfCookie = req.cookies?.csrf_token as string | undefined;
  const csrfHeader = (req.get('x-csrf-token') || req.get('x-xsrf-token')) ?? undefined;

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    throw new BadRequestException('Bad CSRF token');
  }

  const origin = req.get('origin') || '';
  const allowed = getAllowedOrigins();
  if (origin && allowed.length && !allowed.includes(origin)) {
    throw new BadRequestException('Bad Origin');
  }
}

export function issueNewCsrf(res: Response) {
  const token = randomBytes(32).toString('base64url');
  setCsrfCookie(res, token);
  return token;
}
