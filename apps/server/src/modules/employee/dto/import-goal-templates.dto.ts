import { ArrayMinSize, IsArray, IsInt, IsString, Max, Min } from 'class-validator';

export class ImportGoalTemplatesDto {
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsInt()
  @Min(1)
  @Max(4)
  quarter!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  templateIds!: string[];
}
