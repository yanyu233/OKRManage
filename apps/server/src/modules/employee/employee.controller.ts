import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { SessionService } from '../session/session.service';
import { AuthUser } from '../../shared/types/auth-user';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { buildInlineContentDisposition } from '../../shared/http/content-disposition';
import { EmployeeService } from './employee.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { ImportGoalTemplatesDto } from './dto/import-goal-templates.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { UpdateKrCompletionDto } from './dto/update-kr-completion.dto';
import { UploadProofDto } from './dto/upload-proof.dto';

@Controller('employee')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly sessionService: SessionService
  ) {}

  @Get('okr')
  async getQuarterOverview(
    @Req() request: Request,
    @Query('year', ParseIntPipe) year: number,
    @Query('quarter', ParseIntPipe) quarter: number
  ) {
    const actor = await this.requireEmployee(request);

    try {
      return await this.employeeService.getQuarterOverview(actor, year, quarter);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('goal-templates')
  async getGoalTemplates(
    @Req() request: Request,
    @Query('year', ParseIntPipe) year: number,
    @Query('quarter', ParseIntPipe) quarter: number
  ) {
    const actor = await this.requireEmployee(request);

    try {
      return await this.employeeService.getGoalTemplates(actor, year, quarter);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Post('goal-templates/import')
  async importGoalTemplates(@Req() request: Request, @Body() payload: ImportGoalTemplatesDto) {
    const actor = await this.requireEmployee(request);

    try {
      return await this.employeeService.importGoalTemplates(actor, payload.year, payload.quarter, payload.templateIds);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Post('goals')
  async createGoal(@Req() request: Request, @Body() payload: CreateGoalDto) {
    const actor = await this.requireEmployee(request);

    try {
      return await this.employeeService.createGoal(actor, {
        year: payload.year,
        quarter: payload.quarter,
        name: payload.name,
        description: payload.description ?? null,
        keyResults: payload.keyResults.map((keyResult) => ({
          code: keyResult.code,
          name: keyResult.name,
          description: keyResult.description ?? null,
          points: keyResult.points,
          scoreType: keyResult.scoreType
        }))
      });
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('goals/:goalId')
  async getGoalDetail(@Req() request: Request, @Param('goalId') goalId: string) {
    const actor = await this.requireEmployee(request);

    try {
      return await this.employeeService.getGoalDetail(actor, goalId);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Put('goals/:goalId')
  async updateGoal(@Req() request: Request, @Param('goalId') goalId: string, @Body() payload: UpdateGoalDto) {
    const actor = await this.requireEmployee(request);

    try {
      return await this.employeeService.updateGoal(actor, goalId, {
        name: payload.name,
        description: payload.description ?? null,
        keyResults: payload.keyResults.map((keyResult) => ({
          id: keyResult.id,
          code: keyResult.code,
          name: keyResult.name,
          description: keyResult.description ?? null,
          points: keyResult.points,
          scoreType: keyResult.scoreType
        }))
      });
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Delete('goals/:goalId')
  @HttpCode(204)
  async deleteGoal(@Req() request: Request, @Param('goalId') goalId: string) {
    const actor = await this.requireEmployee(request);

    try {
      await this.employeeService.deleteGoal(actor, goalId);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Delete('key-results/:krId')
  @HttpCode(204)
  async deleteKeyResult(@Req() request: Request, @Param('krId') krId: string) {
    const actor = await this.requireEmployee(request);

    try {
      await this.employeeService.deleteKeyResult(actor, krId);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Put('key-results/:krId/completion')
  async updateKeyResultCompletion(
    @Req() request: Request,
    @Param('krId') krId: string,
    @Body() payload: UpdateKrCompletionDto
  ) {
    const actor = await this.requireEmployee(request);

    try {
      return await this.employeeService.updateKeyResultCompletion(actor, krId, payload.completionState);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Post('key-results/:krId/proofs')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProof(
    @Req() request: Request,
    @Param('krId') krId: string,
    @Body() payload: UploadProofDto,
    @UploadedFile() file: any
  ) {
    const actor = await this.requireEmployee(request);

    try {
      return await this.employeeService.uploadProof(actor, krId, file, payload.note);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('proofs/:proofId/download')
  async downloadProof(
    @Req() request: Request,
    @Param('proofId') proofId: string,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    const actor = await this.requireProofViewer(request);

    try {
      const result = await this.employeeService.downloadProof(actor, proofId);
      response.setHeader('Content-Disposition', buildInlineContentDisposition(result.fileName));
      response.setHeader('Content-Type', 'application/octet-stream');
      return result.file;
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('proofs/:proofId/preview-meta')
  async getProofPreviewMeta(
    @Req() request: Request,
    @Param('proofId') proofId: string,
    @Query('entryPath') entryPath: string | undefined
  ) {
    const actor = await this.requireProofViewer(request);

    try {
      return await this.employeeService.getProofPreviewMeta(actor, proofId, entryPath);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('proofs/:proofId/archive')
  async getProofArchive(@Req() request: Request, @Param('proofId') proofId: string) {
    const actor = await this.requireProofViewer(request);

    try {
      return await this.employeeService.getProofArchive(actor, proofId);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('proofs/:proofId/archive/entry')
  async downloadProofArchiveEntry(
    @Req() request: Request,
    @Param('proofId') proofId: string,
    @Query('entryPath') entryPath: string | undefined,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    const actor = await this.requireProofViewer(request);

    if (!entryPath?.trim()) {
      throw new BadRequestException('archive entry path is required');
    }

    try {
      const result = await this.employeeService.downloadProofArchiveEntry(actor, proofId, entryPath);
      response.setHeader('Content-Disposition', buildInlineContentDisposition(result.fileName));
      response.setHeader('Content-Type', 'application/octet-stream');
      return result.file;
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  private async requireEmployee(request: Request): Promise<AuthUser> {
    const session = await this.requireSession(request);

    if (!['employee', 'department-head'].includes(session.user.role)) {
      throw new ForbiddenException('employee role required');
    }

    return session.user;
  }

  private async requireProofViewer(request: Request): Promise<AuthUser> {
    const session = await this.requireSession(request);

    if (!['employee', 'department-head', 'section-leader', 'group-leader', 'system-admin'].includes(session.user.role)) {
      throw new ForbiddenException('proof viewer role required');
    }

    return session.user;
  }

  private async requireSession(request: Request) {
    const sessionId = this.readSessionId(request);
    const session = await this.sessionService.get(sessionId);

    if (!session) {
      throw new UnauthorizedException('authentication required');
    }

    return session;
  }

  private readSessionId(request: Request): string | null {
    const cookieHeader = request.headers.cookie || '';
    const target = `${this.sessionService.getCookieName()}=`;
    const value = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(target));

    return value ? value.slice(target.length) : null;
  }

  private rethrowDomainError(error: unknown): never {
    if (error instanceof DomainValidationError) {
      throw new BadRequestException(error.message);
    }

    throw error;
  }
}
