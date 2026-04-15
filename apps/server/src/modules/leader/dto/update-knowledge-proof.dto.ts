import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateKnowledgeProofDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
