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
  UnauthorizedException
} from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from '../session/session.service';
import { AuthUser } from '../../shared/types/auth-user';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { LeaderService } from './leader.service';
import { BulkScoreDto } from './dto/bulk-score.dto';
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
        excludeTemplateGoals: payload.excludeTemplateGoals ?? false
      });
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

  private async requireLeader(request: Request): Promise<AuthUser> {
    const sessionId = this.readSessionId(request);
    const session = await this.sessionService.get(sessionId);

    if (!session) {
      throw new UnauthorizedException('authentication required');
    }

    if (session.user.role !== 'section-leader' && session.user.role !== 'group-leader') {
      throw new ForbiddenException('leader role required');
    }

    return session.user;
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
