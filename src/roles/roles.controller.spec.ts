import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { ROLE } from '../common/helpers/roles';

describe('RolesController', () => {
  let controller: RolesController;
  let service: { setRole: jest.Mock };

  beforeEach(async () => {
    service = { setRole: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [{ provide: RolesService, useValue: service }],
    }).compile();

    controller = module.get<RolesController>(RolesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('has @Roles(admin) metadata on setRole', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      RolesController.prototype.setRole,
    );
    expect(roles).toEqual([ROLE.admin]);
  });

  it('calls service.setRole and returns payload', async () => {
    service.setRole.mockResolvedValueOnce({
      id: 42,
      email: 'a@b.c',
      role: 'manager',
    });

    const res = await controller.setRole(42, { role: 'manager' } as any);

    expect(service.setRole).toHaveBeenCalledWith(42, 'manager');
    expect(res).toEqual({
      ok: true,
      user: { id: 42, email: 'a@b.c', role: 'manager' },
    });
  });

  it('bubbles up service errors', async () => {
    service.setRole.mockRejectedValueOnce(new Error('boom'));
    await expect(controller.setRole(99, { role: 'manager' } as any))
      .rejects.toThrow('boom');
  });
});
