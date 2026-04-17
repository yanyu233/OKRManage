import {
  BadRequestException,
  Body,
  Controller,
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
  UploadedFile,
  UseInterceptors,
  UnauthorizedException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { SessionService } from '../session/session.service';
import { AuthUser } from '../../shared/types/auth-user';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { buildInlineContentDisposition } from '../../shared/http/content-disposition';
import { LeaderService } from './leader.service';
import { BulkScoreDto } from './dto/bulk-score.dto';
import { DownloadKnowledgeProofsDto } from './dto/download-knowledge-proofs.dto';
import { UpdateKnowledgeProofDto } from './dto/update-knowledge-proof.dto';
import { UpdateProofKnowledgeDto } from './dto/update-proof-knowledge.dto';
import { UpdateKrScoreDto } from './dto/update-kr-score.dto';

@Controller('leader')
export class LeaderController {
  constructor(
    private readonly leaderService: LeaderService,
    private readonly sessionService: SessionService
  ) {}

  @Get('workbench')
  async getWorkbench(
    @Req() request: Request,
    @Query('year', ParseIntPipe) year: number,
    @Query('quarter', ParseIntPipe) quarter: number,
    @Query('employeeId') employeeId?: string,
    @Query('goalId') goalId?: string
  ) {
    const actor = await this.requireLeader(request);

    try {
      return await this.leaderService.getWorkbench(actor, year, quarter, employeeId, goalId);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('all-okr')
  async getAllOkr(
    @Req() request: Request,
    @Query('year', ParseIntPipe) year: number,
    @Query('quarter', ParseIntPipe) quarter: number
  ) {
    const actor = await this.requireAuthenticatedUser(request);

    try {
      return await this.leaderService.getAllOkr(actor, year, quarter);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Put('key-results/:krId/score')
  async updateKeyResultScore(
    @Req() request: Request,
    @Param('krId') krId: string,
    @Body() payload: UpdateKrScoreDto
  ) {
    const actor = await this.requireLeader(request);

    try {
      return await this.leaderService.updateKeyResultScore(actor, krId, payload.score, payload.comment);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Post('bulk-score')
  @HttpCode(200)
  async bulkScore(@Req() request: Request, @Body() payload: BulkScoreDto) {
    const actor = await this.requireLeader(request);

    try {
      return await this.leaderService.batchScore(actor, {
        year: payload.year,
        quarter: payload.quarter,
        sectionId: payload.sectionId ?? null,
        reviewGroupId: payload.reviewGroupId ?? null,
        employeeIds: payload.employeeIds ?? [],
        goalIds: payload.goalIds ?? [],
        keyResultIds: payload.keyResultIds ?? [],
        comment: payload.comment ?? null,
        overwriteExisting: payload.overwriteExisting ?? false,
        excludeTemplateGoals: payload.excludeTemplateGoals ?? false,
        allowMissingProofs: payload.allowMissingProofs ?? false
      });
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Put('proofs/:proofId/knowledge')
  async updateProofKnowledge(
    @Req() request: Request,
    @Param('proofId') proofId: string,
    @Body() payload: UpdateProofKnowledgeDto
  ) {
    const actor = await this.requireAuthenticatedUser(request);

    try {
      return await this.leaderService.updateProofKnowledge(actor, proofId, payload.isKnowledge);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('knowledge-base')
  async getKnowledgeBase(@Req() request: Request) {
    const actor = await this.requireAuthenticatedUser(request);

    try {
      return await this.leaderService.getKnowledgeBase(actor);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Post('knowledge-base/download')
  @HttpCode(200)
  async downloadKnowledgeProofs(
    @Req() request: Request,
    @Body() payload: DownloadKnowledgeProofsDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    const actor = await this.requireAuthenticatedUser(request);

    try {
      const result = await this.leaderService.downloadKnowledgeProofs(actor, payload.proofIds);
      response.setHeader('Content-Disposition', buildInlineContentDisposition(result.fileName));
      response.setHeader('Content-Type', 'application/zip');
      return result.file;
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Put('knowledge-base/:proofId')
  @UseInterceptors(FileInterceptor('file'))
  async updateKnowledgeProof(
    @Req() request: Request,
    @Param('proofId') proofId: string,
    @Body() payload: UpdateKnowledgeProofDto,
    @UploadedFile() file: any
  ) {
    const actor = await this.requireAuthenticatedUser(request);

    try {
      return await this.leaderService.updateKnowledgeProof(actor, proofId, file, payload.note);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('ranking')
  async getRanking(
    @Req() request: Request,
    @Query('year', ParseIntPipe) year: number,
    @Query('quarter', ParseIntPipe) quarter: number,
    @Query('reviewGroupId') reviewGroupId?: string,
    @Query('employeeId') employeeId?: string
  ) {
    const actor = await this.requireLeader(request);

    try {
      return await this.leaderService.getRanking(actor, year, quarter, reviewGroupId, employeeId);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('ranking/public-notice')
  async downloadQuarterlyPublicNotice(
    @Req() request: Request,
    @Query('year', ParseIntPipe) year: number,
    @Query('quarter', ParseIntPipe) quarter: number,
    @Query('reviewGroupId') reviewGroupId: string | undefined,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    const actor = await this.requireLeader(request);

    try {
      const result = await this.leaderService.downloadQuarterlyPublicNotice(actor, year, quarter, reviewGroupId);
      response.setHeader('Content-Disposition', buildInlineContentDisposition(result.fileName));
      response.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      return result.file;
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('annual-ranking')
  async getAnnualRanking(
    @Req() request: Request,
    @Query('year', ParseIntPipe) year: number,
    @Query('employeeId') employeeId?: string
  ) {
    const actor = await this.requireLeader(request);

    try {
      return await this.leaderService.getAnnualRanking(actor, year, employeeId);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('annual-ranking/public-notice')
  async downloadAnnualPublicNotice(
    @Req() request: Request,
    @Query('year', ParseIntPipe) year: number,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    const actor = await this.requireLeader(request);

    try {
      const result = await this.leaderService.downloadAnnualPublicNotice(actor, year);
      response.setHeader('Content-Disposition', buildInlineContentDisposition(result.fileName));
      response.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      return result.file;
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  private async requireLeader(request: Request): Promise<AuthUser> {
    const session = await this.requireSession(request);

    if (!['department-head', 'section-leader', 'group-leader'].includes(session.user.role)) {
      throw new ForbiddenException('leader role required');
    }

    return session.user;
  }

  private async requireAuthenticatedUser(request: Request): Promise<AuthUser> {
    const session = await this.requireSession(request);
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
