import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested
} from 'class-validator';
import { REVIEW_GRADE_CODES, type ReviewGradeCode } from '../../../shared/constants/review-grade-codes';

class DepartmentSnapshotDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  isActive!: boolean;
}

class SectionSnapshotDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  departmentId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  isActive!: boolean;
}

class UserSnapshotDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsOptional()
  @IsString()
  employeeNo?: string | null;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  sectionId?: string | null;

  @IsOptional()
  @IsString()
  reviewGroupId?: string | null;

  @IsBoolean()
  isActive!: boolean;
}

class LocalAccountSnapshotDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  loginName!: string;

  @IsBoolean()
  localLoginEnabled!: boolean;

  @IsOptional()
  @IsString()
  password?: string | null;
}

class RoleAssignmentSnapshotDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  roleCode!: string;

  @IsString()
  @IsNotEmpty()
  scopeType!: string;

  @IsString()
  @IsNotEmpty()
  scopeId!: string;

  @IsBoolean()
  isPrimary!: boolean;

  @IsBoolean()
  isEnabled!: boolean;
}

class SectionLeaderBindingSnapshotDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  leaderUserId!: string;

  @IsString()
  @IsNotEmpty()
  sectionId!: string;
}

class GroupLeaderBindingSnapshotDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  leaderUserId!: string;

  @IsString()
  @IsNotEmpty()
  reviewGroupId!: string;
}

class ReviewGroupQuotaSnapshotDto {
  @IsIn(REVIEW_GRADE_CODES)
  gradeCode!: ReviewGradeCode;

  @Type(() => Number)
  seatCount!: number;
}

class ReviewGroupSnapshotDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  isActive!: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewGroupQuotaSnapshotDto)
  quotas!: ReviewGroupQuotaSnapshotDto[];
}

export class SaveOrgBootstrapDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DepartmentSnapshotDto)
  departments!: DepartmentSnapshotDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionSnapshotDto)
  sections!: SectionSnapshotDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserSnapshotDto)
  users!: UserSnapshotDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LocalAccountSnapshotDto)
  localAccounts!: LocalAccountSnapshotDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentSnapshotDto)
  roleAssignments!: RoleAssignmentSnapshotDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SectionLeaderBindingSnapshotDto)
  sectionLeaderBindings!: SectionLeaderBindingSnapshotDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupLeaderBindingSnapshotDto)
  groupLeaderBindings!: GroupLeaderBindingSnapshotDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReviewGroupSnapshotDto)
  reviewGroups!: ReviewGroupSnapshotDto[];
}
