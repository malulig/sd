import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import * as bcrypt from 'bcrypt';
import { PrismaService } from './prisma/prisma.service';

jest.mock('bcrypt', () => ({ hash: jest.fn() }));

describe('AppController', () => {
  let controller: AppController;
  let prisma: {
    user: { upsert: jest.Mock; findMany: jest.Mock };
  };

  const OLD_ENV = process.env;

  beforeEach(async () => {
    jest.resetModules();
    process.env = { ...OLD_ENV };       // изолируем ENV между тестами

    prisma = {
      user: { upsert: jest.fn(), findMany: jest.fn() },
    };

    (bcrypt.hash as jest.Mock).mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('seed-admin', () => {
    it('кидает ошибку, если ADMIN_PASSWORD отсутствует или короче 8', async () => {
      process.env.ADMIN_PASSWORD = '';
      await expect(controller.seedAdmin()).rejects.toThrow('ADMIN_PASSWORD');

      process.env.ADMIN_PASSWORD = 'short';
      await expect(controller.seedAdmin()).rejects.toThrow('ADMIN_PASSWORD');
    });

    it('апсертит админа с хэшом пароля и заданным email', async () => {
      process.env.ADMIN_PASSWORD = 'supersecret';
      process.env.ADMIN_EMAIL = 'root@acme.test';
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pass');

      const createdAt = new Date('2025-01-01T00:00:00Z');
      prisma.user.upsert.mockResolvedValue({
        id: 1,
        email: 'root@acme.test',
        role: 'admin',
        displayName: 'Admin',
        createdAt,
      });

      const res = await controller.seedAdmin();

      expect(bcrypt.hash).toHaveBeenCalledWith('supersecret', 12);
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { email: 'root@acme.test' },
        update: {},
        create: {
          email: 'root@acme.test',
          password: 'hashed_pass',
          role: 'admin',
          displayName: 'Admin',
        },
        select: {
          id: true,
          email: true,
          role: true,
          displayName: true,
          createdAt: true,
        },
      });

      expect(res).toEqual({
        ok: true,
        user: {
          id: 1,
          email: 'root@acme.test',
          role: 'admin',
          displayName: 'Admin',
          createdAt,
        },
      });
    });

    it('по умолчанию берёт email admin@example.com, если ADMIN_EMAIL не задан', async () => {
      process.env.ADMIN_PASSWORD = 'supersecret';
      delete process.env.ADMIN_EMAIL;
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

      prisma.user.upsert.mockResolvedValue({
        id: 2,
        email: 'admin@example.com',
        role: 'admin',
        displayName: 'Admin',
        createdAt: new Date(),
      });

      await controller.seedAdmin();

      // проверяем, что запрос шёл с дефолтным email
      const callArg = prisma.user.upsert.mock.calls[0][0];
      expect(callArg.where.email).toBe('admin@example.com');
      expect(callArg.create.email).toBe('admin@example.com');
    });
  });

  describe('users', () => {
    it('возвращает до 50 пользователей и count', async () => {
      const rows = [
        {
          id: 1,
          email: 'a@b.c',
          role: 'user',
          displayName: 'A',
          createdAt: new Date('2025-02-01T00:00:00Z'),
        },
        {
          id: 2,
          email: 'c@d.e',
          role: 'admin',
          displayName: 'C',
          createdAt: new Date('2025-02-02T00:00:00Z'),
        },
      ];
      prisma.user.findMany.mockResolvedValue(rows);

      const res = await controller.users();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        take: 50,
        orderBy: { id: 'asc' },
        select: {
          id: true,
          email: true,
          role: true,
          displayName: true,
          createdAt: true,
        },
      });

      expect(res).toEqual({ count: 2, users: rows });
    });
  });
});
