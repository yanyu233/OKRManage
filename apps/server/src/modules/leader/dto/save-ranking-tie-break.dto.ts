import { ArrayMinSize, IsArray, IsInt, IsString, Max, Min } from 'class-validator';

export class SaveRankingTieBreakDto {
  @IsInt()
  year!: number;

  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;

  @IsString()
  reviewGroupId!: string;

  @IsString()
  groupKey!: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  orderedEmployeeIds!: string[];
}
