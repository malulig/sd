import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('seed-admin')
  async seedAdmin() {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const plain = process.env.ADMIN_PASSWORD;

    if (!plain || plain.length < 8) {
      throw new InternalServerErrorException(
        'ADMIN_PASSWORD не задан или слишком короткий (минимум 8 символов)',
      );
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(plain, saltRounds);

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {}, 
      create: {
        email,
        password: passwordHash,
        role: 'admin',
        displayName: 'Admin',
      },
      select: { id: true, email: true, role: true, displayName: true, createdAt: true },
    });

    return { ok: true, user };
  }

  @Get('users')
  async users() {
    const users = await this.prisma.user.findMany({
      take: 50,
      orderBy: { id: 'asc' },
      select: { id: true, email: true, role: true, displayName: true, createdAt: true },
    });
    return { count: users.length, users };
  }
}
