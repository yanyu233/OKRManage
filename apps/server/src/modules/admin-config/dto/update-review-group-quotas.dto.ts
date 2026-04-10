import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, Min, ValidateNested } from 'class-validator';
import { REVIEW_GRADE_CODES } from '../../../shared/constants/review-grade-codes';

class ReviewGroupQuotaDto {
  @IsIn(REVIEW_GRADE_CODES)
  gradeCode!: (typeof REVIEW_GRADE_CODES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  seatCount!: number;
}

export class UpdateReviewGroupQuotasDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReviewGroupQuotaDto)
  quotas!: ReviewGroupQuotaDto[];
}
