import { Session } from '@/auth/entities/session.entity';
import { AppRole } from '@/common/domain/role.enum';
import { User } from '@/users/entities/user.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';


@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Session) private readonly sessions: Repository<Session>,
  ) {}

  async setRole(userId: number, role: AppRole) {
    await this.users.update({ id: userId }, { role: role as any });

    const user = await this.users.findOneOrFail({
      where: { id: userId },
      select: { id: true, email: true, role: true as any },
    });

    // ревок всех активных сессий пользователя
    await this.sessions.update(
      { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      { revokedAt: new Date() },
    );

    return user;
  }
}
