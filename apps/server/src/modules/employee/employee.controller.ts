import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
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
import { EmployeeService } from './employee.service';
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

  @Get('goals/:goalId')
  async getGoalDetail(@Req() request: Request, @Param('goalId') goalId: string) {
    const actor = await this.requireEmployee(request);

    try {
      return await this.employeeService.getGoalDetail(actor, goalId);
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
      response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(result.fileName)}"`);
      response.setHeader('Content-Type', 'application/octet-stream');
      return result.file;
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  private async requireEmployee(request: Request): Promise<AuthUser> {
    const session = await this.requireSession(request);

    if (session.user.role !== 'employee') {
      throw new ForbiddenException('employee role required');
    }

    return session.user;
  }

  private async requireProofViewer(request: Request): Promise<AuthUser> {
    const session = await this.requireSession(request);

    if (!['employee', 'section-leader', 'group-leader'].includes(session.user.role)) {
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
