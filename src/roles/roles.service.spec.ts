import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RolesService } from './roles.service';
import { User } from '@/users/entities/user.entity';
import { Session } from '@/auth/entities/session.entity';

describe('RolesService', () => {
  let service: RolesService;

  const userRepo: Partial<Record<keyof Repository<User>, jest.Mock>> = {
    update: jest.fn(),
    findOneOrFail: jest.fn(),
  };

  const sessionRepo: Partial<Record<keyof Repository<Session>, jest.Mock>> = {
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Session), useValue: sessionRepo },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('sets role and revokes active sessions', async () => {
    userRepo.update!.mockResolvedValueOnce(undefined);
    userRepo.findOneOrFail!.mockResolvedValueOnce({
      id: 1,
      email: 'x@y.z',
      role: 'admin',
    });
    sessionRepo.update!.mockResolvedValueOnce({ affected: 3 });

    const user = await service.setRole(1, 'admin');

    expect(userRepo.update).toHaveBeenCalledWith({ id: 1 }, { role: 'admin' });

    expect(userRepo.findOneOrFail).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true, email: true, role: true },
    });

    expect(sessionRepo.update).toHaveBeenCalledTimes(1);
    const [whereArg, dataArg] = sessionRepo.update!.mock.calls[0];

    expect(whereArg).toEqual(expect.objectContaining({ userId: 1 }));
    expect(dataArg.revokedAt).toBeInstanceOf(Date);

    expect(user).toEqual({ id: 1, email: 'x@y.z', role: 'admin' });
  });

  it('bubbles up repository errors', async () => {
    userRepo.update!.mockRejectedValueOnce(new Error('boom'));
    await expect(service.setRole(2, 'manager')).rejects.toThrow('boom');
  });
});
