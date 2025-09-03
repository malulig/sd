import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { User } from '@/users/entities/user.entity';
import { Session } from '@/auth/entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, Session])],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
