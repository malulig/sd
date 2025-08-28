import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { AppRole } from 'src/common/helpers/roles';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async setRole(userId: number, role: AppRole) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return user;
  }
}
