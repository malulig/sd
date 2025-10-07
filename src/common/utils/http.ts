import type { Request } from 'express';

export function getClientIp(req: Request): string | undefined {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0]!.trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    // xff: string[]
    const first = xff[0];
    return typeof first === 'string' ? first.split(',')[0]!.trim() : undefined;
  }
  return req.socket.remoteAddress || undefined;
}

export function getUserAgent(req: Request): string | undefined {
  const ua = req.headers['user-agent'];
  if (!ua) return undefined;
  if (Array.isArray(ua)) {
    // ua: string[]
    return ua.join(' ');
  }
  return ua; // string
}
