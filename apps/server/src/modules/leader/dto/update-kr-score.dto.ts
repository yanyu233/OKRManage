import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateKrScoreDto {
  @IsNumber()
  @Min(0)
  score!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
