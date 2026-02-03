import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AppRole } from '@/common/domain/role.enum';

export interface AccessJwtPayload {
  sub: number;
  email: string;
  role: AppRole;
  iat: number;
  exp: number;
}

function bodyAccessTokenExtractor(req: Request): string | null {
  const token = (req?.body as any)?.access_token;
  return typeof token === 'string' ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(cfg: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        bodyAccessTokenExtractor,                     
        ExtractJwt.fromAuthHeaderAsBearerToken(),    
      ]),
      secretOrKey: cfg.get<string>('JWT_ACCESS_SECRET')!,
      ignoreExpiration: false,
    });
  }

  async validate(payload: AccessJwtPayload) {
    console.log('validate', JSON.stringify(payload, null, 2));
    
    return { sub: payload.sub, email: payload.email, role: payload.role };
  }
}
