import { Module } from '@nestjs/common';
import { EMPLOYEE_REPOSITORY } from '../../infrastructure/repositories/employee/employee.repository';
import { PrismaEmployeeRepository } from '../../infrastructure/repositories/employee/prisma-employee.repository';
import { LocalProofStorageService } from '../../infrastructure/storage/local-proof-storage.service';
import { AuditModule } from '../audit/audit.module';
import { SessionModule } from '../session/session.module';
import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';

@Module({
  imports: [SessionModule, AuditModule],
  controllers: [EmployeeController],
  providers: [
    EmployeeService,
    PrismaEmployeeRepository,
    LocalProofStorageService,
    {
      provide: EMPLOYEE_REPOSITORY,
      useExisting: PrismaEmployeeRepository
    }
  ]
})
export class EmployeeModule {}
