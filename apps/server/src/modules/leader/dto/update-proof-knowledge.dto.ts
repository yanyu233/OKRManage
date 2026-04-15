import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class UpdateProofKnowledgeDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  isKnowledge!: boolean;
}
