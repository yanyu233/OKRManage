import { IsString, MinLength } from 'class-validator';

export class SwitchActiveRoleDto {
  @IsString()
  @MinLength(1)
  role!: string;
}
