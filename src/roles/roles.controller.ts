import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { SetRoleDto } from './dto/set-role.dto';
import { RolesService } from './roles.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/domain/role.enum';  

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Roles(Role.admin) 
  @Post(':userId')
  async setRole(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetRoleDto,
  ) {
    const updated = await this.rolesService.setRole(userId, dto.role);
    return { ok: true, user: updated };
  }
}
