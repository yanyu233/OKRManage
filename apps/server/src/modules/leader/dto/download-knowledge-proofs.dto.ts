import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class DownloadKnowledgeProofsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  proofIds!: string[];
}
