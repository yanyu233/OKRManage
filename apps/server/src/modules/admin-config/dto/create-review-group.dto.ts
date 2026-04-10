import { IsString, MinLength } from 'class-validator';

export class CreateReviewGroupDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
