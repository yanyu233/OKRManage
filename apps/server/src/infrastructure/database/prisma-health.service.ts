import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}
