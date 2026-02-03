import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';

import { AzureMsalService } from '@/azure/azure-msal.service';
import { User } from '@/users/entities/user.entity';
import { Public } from '@/common/decorators/public.decorator';
import { AuthUser, RequestUser } from '@/common/decorators/auth-user.decorator';
import { Role, type AppRole } from '@/common/domain/role.enum';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

import { AzureIdTokenClaims, extractEmail } from '@/common/types/azure';
import { setRefreshCookie, setSidCookie, clearAuthCookies } from '@/common/utils/cookies';
import { assertCsrfAndOrigin, issueNewCsrf } from '@/common/utils/csrf';
import { getAllowedOrigins, getPrimaryClientUrl } from '@/common/utils/origin';
import { getClientIp, getUserAgent } from '@/common/utils/http';
import { RefreshDto } from './dto/refresh.dto';

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
    res.redirect(await this.msal.buildAuthUrl());
  }

  @Public()
  @Get('azure/callback')
  async azureCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const currentUrl = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
      const result = await this.msal.exchangeCode(currentUrl);

      const claims = (result.idTokenClaims ?? {}) as AzureIdTokenClaims;
      const azureId = claims.oid ?? claims.sub;
      if (!azureId) throw new BadRequestException('Azure ID (oid/sub) not found');

      const email = extractEmail(claims); // string | null
      const displayName = typeof claims.name === 'string' && claims.name.trim() ? claims.name : null;
      const azureTenantId = typeof claims.tid === 'string' && claims.tid.trim() ? claims.tid : null;

      let user = await this.users.findOneBy({ azureId });

      if (user) {
        if (displayName) user.displayName = displayName;
        if (azureTenantId) user.azureTenantId = azureTenantId;
        user = await this.users.save(user);
      } else if (email) {
        const byEmail = await this.users.findOneBy({ email });
        if (byEmail) {
          byEmail.azureId = azureId;
          if (azureTenantId) byEmail.azureTenantId = azureTenantId;
          if (displayName) byEmail.displayName = displayName;
          user = await this.users.save(byEmail);
        }
      }

      if (!user) {
        const newUser: DeepPartial<User> = {
          ...(email ? { email } : {}),
          password: await bcrypt.hash(randomUUID(), 12),
          role: Role.user,
          ...(displayName ? { displayName } : {}),
          azureId,
          ...(azureTenantId ? { azureTenantId } : {}),
        };
        user = await this.users.save(this.users.create(newUser));
      }

      const jwtUser = { id: user.id, email: user.email, role: user.role as AppRole };

      const refreshToken = await this.auth.signRefreshToken(jwtUser);
      const sessionId = await this.auth.createSession(
        user.id,
        refreshToken,
        getUserAgent(req),
        getClientIp(req),
      );

      setRefreshCookie(res, refreshToken);
      setSidCookie(res, sessionId);
      issueNewCsrf(res);

      const frontendUrl = getPrimaryClientUrl() ?? getAllowedOrigins()[0] ?? '/';
      res.redirect(`${frontendUrl}/me`);
    } catch {
      res.status(500).send('Ошибка авторизации');
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  profile(@AuthUser() user: RequestUser) {
    return user;
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response, @Body() body: RefreshDto) {
    assertCsrfAndOrigin(req);

    const sid = req.cookies?.sid as string | undefined;
    const oldRefresh = (req.cookies?.refresh_token as string | undefined) ?? body.refreshToken;
    if (!sid || !oldRefresh) throw new BadRequestException('No session or refresh token');

    const payload = await this.auth.verifyRefreshToken(oldRefresh);
    const dbUser = await this.users.findOneOrFail({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });

    const jwtUser = { id: dbUser.id, email: dbUser.email, role: dbUser.role as AppRole };
    const rotated = await this.auth.rotateSession(
      sid,
      oldRefresh,
      jwtUser,
      getUserAgent(req),
      getClientIp(req),
    );

    setRefreshCookie(res, rotated.refreshToken);
    res.json({ ok: true, access_token: rotated.accessToken, expires_in: 15 * 60 });
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    assertCsrfAndOrigin(req);
    const sid = req.cookies?.sid as string | undefined;
    if (sid) await this.auth.revokeSession(sid);
    clearAuthCookies(res);
    res.json({ ok: true });
  }
}
