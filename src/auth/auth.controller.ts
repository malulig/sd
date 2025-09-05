import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AzureMsalService } from '@/azure/azure-msal.service';
import { User } from '@/users/entities/user.entity';
import { Public } from '@/common/decorators/public.decorator';
import { AuthUser, RequestUser } from '@/common/decorators/auth-user.decorator';
import { Role, type AppRole } from '@/common/domain/role.enum';
import { AuthService } from './auth.service';


interface AzureIdTokenClaims {
  oid?: string;
  tid?: string;
  sub?: string;
  name?: string;
  email?: string;
  preferred_username?: string;
  emails?: string[];
}

class RefreshDto {
  refreshToken?: string;
}

function sameSite(): 'lax' | 'strict' | 'none' {
  const v = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();
  return v === 'none' ? 'none' : v === 'strict' ? 'strict' : 'lax';
}
function cookieBase() {
  return {
    httpOnly: true as const,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: sameSite(),
    domain: process.env.COOKIE_DOMAIN || undefined,
  };
}
function setRefreshCookie(res: Response, token: string) {
  res.cookie('refresh_token', token, {
    ...cookieBase(),
    path: '/auth',
    maxAge: 30 * 24 * 3600 * 1000,
  });
}
function setSidCookie(res: Response, sid: string) {
  res.cookie('sid', sid, {
    ...cookieBase(),
    path: '/auth',
    maxAge: 30 * 24 * 3600 * 1000,
  });
}
function setCsrfCookie(res: Response, token: string) {
  res.cookie('csrf_token', token, {
    httpOnly: false,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: sameSite(),
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: 30 * 24 * 3600 * 1000,
  });
}
function clearAuthCookies(res: Response) {
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
function assertCsrfAndOrigin(req: Request) {
  const csrfCookie = req.cookies?.csrf_token as string | undefined;
  const csrfHeader = (req.get('x-csrf-token') || req.get('x-xsrf-token')) as
    | string
    | undefined;
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    throw new BadRequestException('Bad CSRF token');
  }
  const origin = req.get('origin') || '';
  const allowed = (process.env.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (origin && allowed.length && !allowed.includes(origin)) {
    throw new BadRequestException('Bad Origin');
  }
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly msal: AzureMsalService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Public()
  @Get('azure/login')
  async azureLogin(@Res() res: Response) {
    const url = await this.msal.buildAuthUrl();
    return res.redirect(url);
  }

  @Public()
  @Get('azure/callback')
  async azureCallback(@Req() req: Request, @Res() res: Response) {
    const currentUrl = new URL(
      `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    );
    const result = await this.msal.exchangeCode(currentUrl);

    const claims = (result.idTokenClaims ?? {}) as AzureIdTokenClaims;
    const azureId = claims.oid ?? claims.sub;
    if (!azureId) throw new BadRequestException('Azure ID (oid/sub) not found');

    const email =
      claims.email ??
      claims.preferred_username ??
      (Array.isArray(claims.emails) ? claims.emails[0] : undefined);
    const displayName = claims.name ?? null;
    const azureTenantId = claims.tid ?? null;

    // upsert user (по azureId, иначе по email)
    let user = await this.users.findOneBy({ azureId });

    if (user) {
      user.displayName = displayName ?? user.displayName;
      user.azureTenantId = azureTenantId ?? user.azureTenantId;
      user = await this.users.save(user);
    } else if (email) {
      const byEmail = await this.users.findOneBy({ email });
      if (byEmail) {
        byEmail.azureId = azureId;
        byEmail.azureTenantId = azureTenantId ?? byEmail.azureTenantId;
        byEmail.displayName = displayName ?? byEmail.displayName;
        user = await this.users.save(byEmail);
      }
    }

    if (!user) {
      user = await this.users.save(
        this.users.create({
          email: email,
          password: await bcrypt.hash(randomUUID(), 12), 
          role: Role.user,
          displayName,
          azureId,
          azureTenantId,
        }) as User,
      );
    }

    const jwtUser = {
      id: user!.id,
      email: user.email,
      role: user.role as AppRole,
    };

    const accessToken = await this.auth.signAccessToken(jwtUser);
    const refreshToken = await this.auth.signRefreshToken(jwtUser);
    const sessionId = await this.auth.createSession(
      user.id,
      refreshToken,
      req.headers['user-agent']?.toString(),
      (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        undefined,
    );

    setRefreshCookie(res, refreshToken);
    setSidCookie(res, sessionId);
    const csrfToken = randomBytes(32).toString('base64url');
    setCsrfCookie(res, csrfToken);

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
      },
      access_token: accessToken,
      expires_in: 15 * 60,
    });
  }

  @Post('profile')
  profile(@AuthUser() user: RequestUser) {
    return user; // { sub, email, role }
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body: RefreshDto,
  ) {
    assertCsrfAndOrigin(req);

    const sid = req.cookies?.sid as string | undefined;
    const oldRefresh =
      (req.cookies?.refresh_token as string | undefined) ?? body.refreshToken;
    if (!sid || !oldRefresh)
      throw new BadRequestException('No session or refresh token');

    const payload = await this.auth.verifyRefreshToken(oldRefresh);
    const dbUser = await this.users.findOneOrFail({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });

    const jwtUser = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role as AppRole,
    };

    const rotated = await this.auth.rotateSession(
      sid,
      oldRefresh,
      jwtUser,
      req.headers['user-agent']?.toString(),
      (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        undefined,
    );
    setRefreshCookie(res, rotated.refreshToken);

    return res.json({
      ok: true,
      access_token: rotated.accessToken,
      expires_in: 15 * 60,
    });
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    assertCsrfAndOrigin(req);
    const sid = req.cookies?.sid as string | undefined;
    if (sid) await this.auth.revokeSession(sid);
    clearAuthCookies(res);
    return res.json({ ok: true });
  }
}
