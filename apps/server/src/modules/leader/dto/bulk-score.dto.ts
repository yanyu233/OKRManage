import { IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class BulkScoreDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  reviewGroupId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employeeIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goalIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyResultIds?: string[];

  @IsNumber()
  @Min(0)
  @Max(100)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsBoolean()
  overwriteExisting?: boolean;

  @IsOptional()
  @IsBoolean()
  excludeTemplateGoals?: boolean;
}
