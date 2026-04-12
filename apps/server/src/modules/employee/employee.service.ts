import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { StreamableFile } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../../shared/types/auth-user';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { LocalProofStorageService } from '../../infrastructure/storage/local-proof-storage.service';
import {
  EMPLOYEE_REPOSITORY,
  EmployeeCreateGoalInput,
  EmployeeRepository
} from '../../infrastructure/repositories/employee/employee.repository';

@Injectable()
export class EmployeeService {
  constructor(
    @Inject(EMPLOYEE_REPOSITORY) private readonly employeeRepository: EmployeeRepository,
    private readonly proofStorage: LocalProofStorageService,
    private readonly auditService: AuditService
  ) {}

  getQuarterOverview(actor: AuthUser, year: number, quarter: number) {
    this.validateQuarter(year, quarter);
    return this.employeeRepository.getQuarterOverview(actor, year, quarter);
  }

  getGoalTemplates(actor: AuthUser, year: number, quarter: number) {
    this.validateQuarter(year, quarter);
    return this.employeeRepository.getGoalTemplates(actor, year, quarter);
  }

  async createGoal(actor: AuthUser, input: EmployeeCreateGoalInput) {
    this.validateQuarter(input.year, input.quarter);

    const normalizedName = input.name.trim();
    if (!normalizedName) {
      throw new DomainValidationError('goal name is required');
    }

    const uniqueCodes = new Set<string>();
    for (const keyResult of input.keyResults) {
      const normalizedCode = keyResult.code.trim();
      const normalizedName = keyResult.name.trim();
      if (!normalizedCode) {
        throw new DomainValidationError('key result code is required');
      }

      if (!normalizedName) {
        throw new DomainValidationError('key result name is required');
      }

      if (uniqueCodes.has(normalizedCode.toLowerCase())) {
        throw new DomainValidationError('duplicate key result code');
      }

      uniqueCodes.add(normalizedCode.toLowerCase());
    }

    const result = await this.employeeRepository.createGoal(actor, {
      ...input,
      name: normalizedName,
      description: input.description?.trim() || null,
      keyResults: input.keyResults.map((keyResult) => ({
        code: keyResult.code.trim(),
        name: keyResult.name.trim(),
        description: keyResult.description?.trim() || null,
        points: keyResult.points,
        scoreType: keyResult.scoreType ?? 'objective'
      }))
    });

    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'employee.goal.create',
      entityType: 'goal',
      entityId: result.id,
      afterJson: {
        year: result.year,
        quarter: result.quarter,
        code: result.code,
        name: result.name,
        keyResults: result.keyResults.map((keyResult) => ({
          id: keyResult.id,
          code: keyResult.code,
          scoreType: keyResult.scoreType
        }))
      }
    });

    return result;
  }

  async importGoalTemplates(actor: AuthUser, year: number, quarter: number, templateIds: string[]) {
    this.validateQuarter(year, quarter);

    const uniqueTemplateIds = [...new Set(templateIds.map((entry) => entry.trim()).filter(Boolean))];
    if (!uniqueTemplateIds.length) {
      throw new DomainValidationError('at least one template must be selected');
    }

    const result = await this.employeeRepository.importGoalTemplates(actor, year, quarter, uniqueTemplateIds);
    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'employee.goal-templates.import',
      entityType: 'goal-template-import',
      entityId: actor.id,
      afterJson: {
        year,
        quarter,
        templateIds: uniqueTemplateIds,
        importedGoalIds: result.importedGoals.map((goal) => goal.id)
      }
    });
    return result;
  }

  getGoalDetail(actor: AuthUser, goalId: string) {
    return this.employeeRepository.getGoalDetail(actor, goalId);
  }

  async updateKeyResultCompletion(actor: AuthUser, krId: string, completionState: string) {
    const result = await this.employeeRepository.updateKeyResultCompletion(actor, krId, completionState);
    await this.auditService.write({
      actorUserId: actor.id,
      actorRoleCode: actor.role,
      action: 'employee.kr.completion.update',
      entityType: 'key-result',
      entityId: krId,
      beforeJson: result.before,
      afterJson: {
        completionState: result.after.completionState
      }
    });
    return result.after;
  }

  async uploadProof(
    actor: AuthUser,
    krId: string,
    file: { originalname: string; buffer: Buffer } | undefined,
    note?: string | null
  ) {
    if (!file || !file.originalname || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('proof file is required');
    }

    const stored = await this.proofStorage.save(file.originalname, file.buffer);

    try {
      const result = await this.employeeRepository.createProof(actor, krId, {
        fileName: file.originalname,
        storageKey: stored.storageKey,
        fileSize: stored.fileSize,
        note: note?.trim() || null
      });

      await this.auditService.write({
        actorUserId: actor.id,
        actorRoleCode: actor.role,
        action: 'employee.kr.proof.upload',
        entityType: 'proof',
        entityId: result.proof.id,
        afterJson: {
          keyResultId: result.keyResultId,
          fileName: result.proof.fileName,
          fileSize: result.proof.fileSize
        }
      });

      return result.proof;
    } catch (error) {
      await this.proofStorage.delete(stored.storageKey);
      throw error;
    }
  }

  async downloadProof(actor: AuthUser, proofId: string) {
    const proof = await this.employeeRepository.getProofDownload(actor, proofId);
    const stream = await this.proofStorage.open(proof.storageKey);

    return {
      fileName: proof.fileName,
      file: new StreamableFile(stream)
    };
  }

  private validateQuarter(year: number, quarter: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new DomainValidationError('invalid year');
    }

    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
      throw new DomainValidationError('invalid quarter');
    }
  }
}
