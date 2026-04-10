import { IsString, MinLength } from 'class-validator';

export class UpdateReviewGroupDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
