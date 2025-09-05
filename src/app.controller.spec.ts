import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AppController } from './app.controller';
import { User } from '@/users/entities/user.entity';
import { Role } from '@/common/domain/role.enum';

jest.mock('bcrypt', () => ({ hash: jest.fn() }));

import * as bcrypt from 'bcrypt';

describe('AppController (TypeORM)', () => {
  let controller: AppController;

  // мок репозитория TypeORM
  const userRepo: Partial<Record<keyof Repository<User>, jest.Mock>> = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  const OLD_ENV = process.env;

  beforeEach(async () => {
    jest.resetAllMocks();
    jest.resetModules();
    process.env = { ...OLD_ENV };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: getRepositoryToken(User), useValue: userRepo }],
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

    it('создаёт админа с заданным email, если его нет', async () => {
      process.env.ADMIN_PASSWORD = 'supersecret';
      process.env.ADMIN_EMAIL = 'root@acme.test';
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_pass');

      userRepo.findOne!.mockResolvedValueOnce(null);

      const createdAt = new Date('2025-01-01T00:00:00Z');
      const entity: Partial<User> = {
        email: 'root@acme.test',
        password: 'hashed_pass',
        role: Role.admin,
        displayName: 'Admin',
      };

      userRepo.create!.mockReturnValue(entity);
      userRepo.save!.mockResolvedValueOnce({
        id: 1,
        ...(entity as any),
        createdAt,
      });

      const res = await controller.seedAdmin();

      expect(bcrypt.hash).toHaveBeenCalledWith('supersecret', 12);
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'root@acme.test' } });
      expect(userRepo.create).toHaveBeenCalledWith({
        email: 'root@acme.test',
        password: 'hashed_pass',
        role: Role.admin,
        displayName: 'Admin',
      });
      expect(userRepo.save).toHaveBeenCalledWith(entity);

      expect(res).toEqual({
        ok: true,
        user: {
          id: 1,
          email: 'root@acme.test',
          role: Role.admin,
          displayName: 'Admin',
          createdAt,
        },
      });
    });

    it('возвращает уже существующего админа (без пересоздания)', async () => {
      process.env.ADMIN_PASSWORD = 'supersecret';
      process.env.ADMIN_EMAIL = 'admin@example.com';
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash_should_not_be_used');

      const existing = {
        id: 2,
        email: 'admin@example.com',
        role: Role.admin,
        displayName: 'Admin',
        createdAt: new Date('2025-02-02T00:00:00Z'),
      };

      userRepo.findOne!.mockResolvedValueOnce(existing);

      const res = await controller.seedAdmin();

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'admin@example.com' } });
      expect(userRepo.create).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();

      expect(res).toEqual({ ok: true, user: existing });
    });

    it('по умолчанию берёт email admin@example.com, если ADMIN_EMAIL не задан', async () => {
      process.env.ADMIN_PASSWORD = 'supersecret';
      delete process.env.ADMIN_EMAIL;
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash');

      userRepo.findOne!.mockResolvedValueOnce(null);
      const createdAt = new Date();
      userRepo.create!.mockReturnValue({
        email: 'admin@example.com',
        password: 'hash',
        role: Role.admin,
        displayName: 'Admin',
      });
      userRepo.save!.mockResolvedValueOnce({
        id: 3,
        email: 'admin@example.com',
        role: Role.admin,
        displayName: 'Admin',
        createdAt,
      });

      const res = await controller.seedAdmin();

      // проверяем дефолтный email
      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { email: 'admin@example.com' } });
      expect(res.user.email).toBe('admin@example.com');
    });
  });

  describe('allUsers', () => {
    it('возвращает до 50 пользователей и count', async () => {
      const rows = [
        {
          id: 1,
          email: 'a@b.c',
          role: Role.user,
          displayName: 'A',
          createdAt: new Date('2025-02-01T00:00:00Z'),
        },
        {
          id: 2,
          email: 'c@d.e',
          role: Role.admin,
          displayName: 'C',
          createdAt: new Date('2025-02-02T00:00:00Z'),
        },
      ];
      userRepo.find!.mockResolvedValueOnce(rows);

      const res = await controller.allUsers();

      expect(userRepo.find).toHaveBeenCalledWith({
        take: 50,
        order: { id: 'ASC' },
        select: ['id', 'email', 'role', 'displayName', 'createdAt'],
      });

      expect(res).toEqual({ count: 2, users: rows });
    });
  });
});
