import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class HistoricalPerformanceQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}

class HistoricalPerformanceItemDto {
  @IsString()
  userId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;

  @IsOptional()
  @Type(() => Number)
  score?: number | null;
}

export class SaveHistoricalPerformanceDto extends HistoricalPerformanceQueryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HistoricalPerformanceItemDto)
  items!: HistoricalPerformanceItemDto[];
}
