import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository, ObjectLiteral } from 'typeorm';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Session } from '@/auth/entities/session.entity';
import { User } from '@/users/entities/user.entity';
import { AzureMsalService } from '@/azure/azure-msal.service';

// Универсальный мок репозитория TypeORM
const createRepoMock = <T extends ObjectLiteral = ObjectLiteral>() =>
  ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
    delete: jest.fn(),
    update: jest.fn(),
  }) as unknown as jest.Mocked<Repository<T>>;

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,

        // Моки зависимостей AuthService
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('jwt-token'),
            verify: jest.fn(),
            signAsync: jest.fn().mockResolvedValue('jwt-token'),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') return 'test-secret';
              if (key === 'JWT_EXPIRES_IN') return '1h';
              if (key === 'REFRESH_TTL_DAYS') return 30;
              return undefined;
            }),
          },
        },
        {
          provide: getRepositoryToken(Session),
          useValue: createRepoMock<Session>(),
        },

        {
          provide: AzureMsalService,
          useValue: {
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: createRepoMock<User>(),
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
