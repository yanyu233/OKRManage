import { IsString, MinLength } from 'class-validator';

export class ManualLoginDto {
  @IsString()
  @MinLength(1)
  loginName!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}
