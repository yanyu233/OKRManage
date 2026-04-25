import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

class BulkScoreEntryDto {
  @IsString()
  keyResultId!: string;

  @IsNumber()
  @Min(0)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkScoreEntryDto)
  entries?: BulkScoreEntryDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  score?: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsBoolean()
  overwriteExisting?: boolean;

  @IsOptional()
  @IsBoolean()
  excludeTemplateGoals?: boolean;

  @IsOptional()
  @IsBoolean()
  allowMissingProofs?: boolean;
}
