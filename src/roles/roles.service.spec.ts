import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { PrismaService } from 'prisma/prisma.service';

type PrismaMock = {
  user: { update: jest.Mock };
  session: { updateMany: jest.Mock };
};

describe('RolesService', () => {
  let service: RolesService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = {
      user: { update: jest.fn() },
      session: { updateMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  it('sets role and revokes sessions', async () => {
    prisma.user.update.mockResolvedValueOnce({ id: 1, email: 'x@y.z', role: 'admin' });
    prisma.session.updateMany.mockResolvedValueOnce({ count: 3 });

    const user = await service.setRole(1, 'admin');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { role: 'admin' },
      select: { id: true, email: true, role: true },
    });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(user).toEqual({ id: 1, email: 'x@y.z', role: 'admin' });
  });
});
