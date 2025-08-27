import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

type JwtPayload = { sub: number; email: string; role: string };

const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------- JWT: access / refresh ----------
  async signAccessToken(user: { id: number; email: string; role: string }) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return this.jwt.signAsync(payload); // секрет/TTL берутся из JwtModule (ACCESS)
  }

  async signRefreshToken(user: { id: number; email: string; role: string }) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const refreshSecret = this.cfg.get<string>('JWT_REFRESH_SECRET')!;
    return this.jwt.signAsync(payload, { secret: refreshSecret, expiresIn: `${REFRESH_TTL_DAYS}d` });
  }

  async verifyRefreshToken(token: string) {
    const refreshSecret = this.cfg.get<string>('JWT_REFRESH_SECRET')!;
    return this.jwt.verifyAsync<JwtPayload>(token, { secret: refreshSecret });
  }

  private sessionExpiryDate(): Date {
    return new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  async createSession(userId: number, refreshToken: string, userAgent?: string, ip?: string) {
    const refreshHash = await bcrypt.hash(refreshToken, 12);
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshHash,
        userAgent,
        ip,
        expiresAt: this.sessionExpiryDate(),
      },
      select: { id: true },
    });
    return session.id;
  }

  private async findActiveSession(sessionId: string) {
    return this.prisma.session.findFirst({
      where: { id: sessionId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  async rotateSession(
    sessionId: string,
    oldRefreshToken: string,
    user: { id: number; email: string; role: string },
    userAgent?: string,
    ip?: string,
  ) {
    const session = await this.findActiveSession(sessionId);
    if (!session) throw new UnauthorizedException('Session not found or expired');

    const match = await bcrypt.compare(oldRefreshToken, session.refreshHash);
    if (!match) throw new UnauthorizedException('Invalid refresh token');

    const accessToken = await this.signAccessToken(user);
    const newRefresh = await this.signRefreshToken(user);
    const newHash = await bcrypt.hash(newRefresh, 12);

    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshHash: newHash,
        userAgent,
        ip,
        expiresAt: this.sessionExpiryDate(),
      },
    });

    return { accessToken, refreshToken: newRefresh };
  }

  async revokeSession(sessionId: string) {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
