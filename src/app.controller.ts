import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/users/entities/user.entity';
import { Role } from '@/common/domain/role.enum';

@Controller()
export class AppController {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Get('seed-admin')
  async seedAdmin() {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const plain = process.env.ADMIN_PASSWORD;

    if (!plain || plain.length < 8) {
      throw new InternalServerErrorException(
        'ADMIN_PASSWORD не задан или слишком короткий (минимум 8 символов)',
      );
    }

    const passwordHash = await bcrypt.hash(plain, 12);

    let user = await this.users.findOne({ where: { email } });

    if (!user) {
      user = this.users.create({
        email,
        password: passwordHash,
        role: Role.admin,
        displayName: 'Admin',
      });
      user = await this.users.save(user);
    }

    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
    };
  }

  @Get('users')
  async allUsers() {
    const users = await this.users.find({
      take: 50,
      order: { id: 'ASC' },
      select: ['id', 'email', 'role', 'displayName', 'createdAt'],
    });

    return { count: users.length, users };
  }
}
