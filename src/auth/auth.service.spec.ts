import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository, ObjectLiteral } from 'typeorm'; 

import { AuthService } from './auth.service';
import { Session } from '@/auth/entities/session.entity';

const createRepoMock = <T extends ObjectLiteral = ObjectLiteral>() =>
  ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
    delete: jest.fn(),
    update: jest.fn(),
  }) as unknown as jest.Mocked<Repository<T>>;

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
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
          useValue: createRepoMock<Session>(), // ← тип теперь ок
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
