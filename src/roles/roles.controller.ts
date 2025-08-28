import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { SetRoleDto } from './dto/set-role.dto';
import { RolesService } from './roles.service';
import { ROLE } from '../common/helpers/roles';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Roles(ROLE.admin)
  @Post(':userId')
  async setRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetRoleDto,
  ) {
    const updated = await this.rolesService.setRole(userId, dto.role);
    return { ok: true, user: updated };
  }
}
