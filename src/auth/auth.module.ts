import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { JwtStrategy } from 'src/common/strategy/jwt.strategy';
import { User } from '@/users/entities/user.entity';
import { Session } from './entities/session.entity';
import { AzureMsalService } from '@/azure/azure-msal.service';
import { AuthController } from './auth.service';
import { AuthService } from './auth.controller';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_ACCESS_SECRET')!,
        signOptions: { expiresIn: '15m' },
      }),
    }),
    TypeOrmModule.forFeature([User, Session]),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AzureMsalService, AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
