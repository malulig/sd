import { IsEnum } from 'class-validator';
import { Role, AppRole } from '@/common/domain/role.enum';

export class SetRoleDto {
  @IsEnum(Role)
  role!: AppRole;
}
