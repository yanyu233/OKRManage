import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadProofDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
