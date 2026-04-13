import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class UpdateGoalKeyResultDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  points!: number;

  @IsOptional()
  @IsIn(['objective', 'subjective'])
  scoreType?: 'objective' | 'subjective';
}

export class UpdateGoalDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateGoalKeyResultDto)
  keyResults!: UpdateGoalKeyResultDto[];
}
