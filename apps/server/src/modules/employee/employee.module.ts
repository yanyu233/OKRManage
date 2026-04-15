import { Module } from '@nestjs/common';
import { EMPLOYEE_REPOSITORY } from '../../infrastructure/repositories/employee/employee.repository';
import { PrismaEmployeeRepository } from '../../infrastructure/repositories/employee/prisma-employee.repository';
import { LocalProofStorageService } from '../../infrastructure/storage/local-proof-storage.service';
import { ProofArchiveService } from '../../infrastructure/storage/proof-archive.service';
import { AuditModule } from '../audit/audit.module';
import { SessionModule } from '../session/session.module';
import { EmployeeController } from './employee.controller';
import { EmployeePreviewController } from './employee-preview.controller';
import { EmployeeService } from './employee.service';
import { ProofPdfPreviewService } from './proof-pdf-preview.service';

@Module({
  imports: [SessionModule, AuditModule],
  controllers: [EmployeeController, EmployeePreviewController],
  providers: [
    EmployeeService,
    ProofPdfPreviewService,
    PrismaEmployeeRepository,
    LocalProofStorageService,
    ProofArchiveService,
    {
      provide: EMPLOYEE_REPOSITORY,
      useExisting: PrismaEmployeeRepository
    }
  ]
})
export class EmployeeModule {}
