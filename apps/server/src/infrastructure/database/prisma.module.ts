import { Global, Module } from '@nestjs/common';
import { PrismaHealthService } from './prisma-health.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, PrismaHealthService],
  exports: [PrismaService, PrismaHealthService]
})
export class PrismaModule {}
