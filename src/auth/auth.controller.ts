import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';

import type { AppRole } from '@/common/domain/role.enum';
import { Session } from '@/auth/entities/session.entity';

type JwtPayload = { sub: number; email: string; role: AppRole };

const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
  ) {}

  async signAccessToken(user: { id: number; email: string; role: AppRole }) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.signAsync(payload); // секрет/ttl берутся из JwtModule
  }

  async signRefreshToken(user: { id: number; email: string; role: AppRole }) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const refreshSecret = this.cfg.get<string>('JWT_REFRESH_SECRET')!;
    return this.jwt.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: `${REFRESH_TTL_DAYS}d`,
    });
  }

  async verifyRefreshToken(token: string) {
    const refreshSecret = this.cfg.get<string>('JWT_REFRESH_SECRET')!;
    return this.jwt.verifyAsync<JwtPayload>(token, { secret: refreshSecret });
  }

  private sessionExpiryDate(): Date {
    return new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  async createSession(
    userId: number,
    refreshToken: string,
    userAgent?: string,
    ip?: string,
  ) {
    const refreshHash = await bcrypt.hash(refreshToken, 12);
    const entity = this.sessions.create({
      userId,
      refreshHash,
      userAgent: userAgent ?? null,
      ip: ip ?? null,
      expiresAt: this.sessionExpiryDate(),
    });
    const saved = await this.sessions.save(entity);
    return saved.id;
  }

  async rotateSession(
    sessionId: string,
    oldRefreshToken: string,
    user: { id: number; email: string; role: AppRole },
    userAgent?: string,
    ip?: string,
  ) {
    const session = await this.sessions.findOne({
      where: { id: sessionId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!session) throw new UnauthorizedException('Session not found or expired');

    const match = await bcrypt.compare(oldRefreshToken, session.refreshHash);
    if (!match) throw new UnauthorizedException('Invalid refresh token');

    const accessToken = await this.signAccessToken(user);
    const newRefresh = await this.signRefreshToken(user);

    session.refreshHash = await bcrypt.hash(newRefresh, 12);
    session.userAgent = userAgent ?? null;
    session.ip = ip ?? null;
    session.expiresAt = this.sessionExpiryDate();
    await this.sessions.save(session);

    return { accessToken, refreshToken: newRefresh };
  }

  async revokeSession(sessionId: string) {
    await this.sessions.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
