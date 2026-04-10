import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { REVIEW_GRADE_CODES } from '../../../shared/constants/review-grade-codes';
import { ReviewGroupQuotaInput, ReviewGroupsRepository } from './review-groups.repository';

@Injectable()
export class PrismaReviewGroupsRepository implements ReviewGroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listAll() {
    const reviewGroups = await this.prisma.reviewGroup.findMany({
      orderBy: {
        createdAt: 'asc'
      },
      include: {
        quotas: {
          orderBy: {
            gradeCode: 'asc'
          }
        },
        users: {
          where: {
            isActive: true
          },
          select: {
            id: true
          }
        }
      }
    });

    return reviewGroups.map((reviewGroup) => ({
      id: reviewGroup.id,
      name: reviewGroup.name,
      isActive: reviewGroup.isActive,
      memberCount: reviewGroup.users.length,
      quotas: REVIEW_GRADE_CODES.map((gradeCode) => ({
        gradeCode,
        seatCount: reviewGroup.quotas.find((quota) => quota.gradeCode === gradeCode)?.seatCount ?? 0
      }))
    }));
  }

  create(name: string) {
    return this.prisma.reviewGroup.create({
      data: {
        name,
        isActive: true,
        quotas: {
          create: REVIEW_GRADE_CODES.map((gradeCode) => ({
            gradeCode,
            seatCount: 0
          }))
        }
      },
      select: {
        id: true,
        name: true,
        isActive: true
      }
    });
  }

  update(id: string, name: string) {
    return this.prisma.reviewGroup.update({
      where: { id },
      data: { name },
      select: {
        id: true,
        name: true,
        isActive: true
      }
    });
  }

  delete(id: string): Promise<void> {
    return this.prisma.reviewGroup
      .delete({
        where: { id }
      })
      .then(() => undefined);
  }

  async saveQuotas(id: string, quotas: ReviewGroupQuotaInput[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.reviewGradeQuota.deleteMany({
        where: {
          reviewGroupId: id
        }
      }),
      this.prisma.reviewGradeQuota.createMany({
        data: quotas.map((quota) => ({
          reviewGroupId: id,
          gradeCode: quota.gradeCode,
          seatCount: quota.seatCount
        }))
      })
    ]);
  }
}
