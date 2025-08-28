import { IsEnum } from 'class-validator';
import { AppRole, ROLE } from '../../common/helpers/roles';

export class SetRoleDto {
  @IsEnum(ROLE) 
  role!: AppRole;
}
