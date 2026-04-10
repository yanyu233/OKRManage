import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrgRepository } from './org.repository';

@Injectable()
export class PrismaOrgRepository implements OrgRepository {
  constructor(private readonly prisma: PrismaService) {}

  countActiveUsersByReviewGroupId(reviewGroupId: string): Promise<number> {
    return this.prisma.user.count({
      where: {
        reviewGroupId,
        isActive: true
      }
    });
  }
}
