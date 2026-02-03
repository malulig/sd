import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
  import { mergeMap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuthService } from '@/auth/auth.service';
import { User } from '@/users/entities/user.entity';
import type { AppRole } from '@/common/domain/role.enum';

function isMutating(method: string) {
  const m = method.toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

function cookieOpts() {
  const secure = process.env.COOKIE_SECURE === 'true';
  const sameSite = (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') ?? 'lax';
  const domain = process.env.COOKIE_DOMAIN || undefined;
  const base = { httpOnly: true as const, secure, sameSite, domain };
  return { ...base, path: '/auth', maxAge: 30 * 24 * 3600 * 1000 };
}

@Injectable()
export class RotateOnMutationInterceptor implements NestInterceptor {
  constructor(
    private readonly auth: AuthService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    if (!isMutating(req.method)) {
      return next.handle();
    }

    // CSRF + Origin
    const csrfCookie = req.cookies?.csrf_token as string | undefined;
    const csrfHeader = (req.get('x-csrf-token') || req.get('x-xsrf-token')) as string | undefined;
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException('Bad CSRF token');
    }
    const origin = req.get('origin') || '';
    const allowed = (process.env.CLIENT_URL || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (origin && allowed.length && !allowed.includes(origin)) {
      throw new ForbiddenException('Bad Origin');
    }

    // Session cookies
    const sid = req.cookies?.sid as string | undefined;
    const oldRefresh = req.cookies?.refresh_token as string | undefined;
    if (!sid || !oldRefresh) {
      throw new UnauthorizedException('Missing session');
    }

    return next.handle().pipe(
      mergeMap(async (data) => {
        // верификация refresh и подтягивание актуального пользователя
        const payload = await this.auth.verifyRefreshToken(oldRefresh);
        const dbUser = await this.users.findOneOrFail({
          where: { id: payload.sub },
          select: { id: true, email: true, role: true },
        });

        const rotated = await this.auth.rotateSession(
          sid,
          oldRefresh,
          { id: dbUser.id, email: dbUser.email, role: dbUser.role as AppRole },
          req.headers['user-agent']?.toString(),
          (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || undefined,
        );

        res.cookie('refresh_token', rotated.refreshToken, cookieOpts());

        if (data && typeof data === 'object' && !Array.isArray(data)) {
          return { ...data, access_token: rotated.accessToken };
        }
        res.setHeader('X-Access-Token', rotated.accessToken);
        return data;
      }),
    );
  }
}
