import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GoalStatusControlQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class GoalStatusTransitionDto extends GoalStatusControlQueryDto {
  @IsIn(['draft', 'confirmed', 'pending-review'])
  targetStatus!: 'draft' | 'confirmed' | 'pending-review';
}
