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
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  StreamableFile,
  UnauthorizedException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import { SessionService } from '../session/session.service';
import { AuthUser } from '../../shared/types/auth-user';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { AdminConfigService } from './admin-config.service';
import { AdminConfigExcelService } from './admin-config-excel.service';
import { CreateReviewGroupDto } from './dto/create-review-group.dto';
import { GoalStatusTransitionDto } from './dto/goal-status-control.dto';
import { SaveOrgBootstrapDto } from './dto/save-org-bootstrap.dto';
import { UpdateReviewGroupDto } from './dto/update-review-group.dto';
import { UpdateReviewGroupQuotasDto } from './dto/update-review-group-quotas.dto';

@Controller('admin')
export class AdminConfigController {
  constructor(
    private readonly adminConfigService: AdminConfigService,
    private readonly adminConfigExcelService: AdminConfigExcelService,
    private readonly sessionService: SessionService
  ) {}

  @Get('org/bootstrap')
  async getBootstrap(@Req() request: Request) {
    await this.requireSystemAdmin(request);
    return this.adminConfigService.getBootstrap();
  }

  @Get('org/bootstrap/excel')
  async exportBootstrapExcel(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.requireSystemAdmin(request);
    const buffer = await this.adminConfigExcelService.exportWorkbook();

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="admin-config.xlsx"'
    );

    return new StreamableFile(buffer);
  }

  @Post('org/bootstrap/excel')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  async importBootstrapExcel(
    @Req() request: Request,
    @UploadedFile() file: { buffer?: Buffer } | undefined
  ) {
    const actor = await this.requireSystemAdmin(request);

    if (!file?.buffer?.length) {
      throw new BadRequestException('excel file is required');
    }

    try {
      return await this.adminConfigExcelService.importWorkbook(file.buffer, actor);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Put('org/bootstrap')
  async saveBootstrap(@Req() request: Request, @Body() payload: SaveOrgBootstrapDto) {
    const actor = await this.requireSystemAdmin(request);

    try {
      return await this.adminConfigService.saveBootstrap(payload as never, actor);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Get('goal-status-control')
  async getGoalStatusControls(
    @Req() request: Request,
    @Query('year', ParseIntPipe) year: number,
    @Query('quarter', ParseIntPipe) quarter: number,
    @Query('userId') userId?: string
  ) {
    await this.requireSystemAdmin(request);
    return this.adminConfigService.getGoalStatusControls(year, quarter, userId);
  }

  @Post('goal-status-control/transition')
  @HttpCode(200)
  async transitionGoalStatuses(@Req() request: Request, @Body() payload: GoalStatusTransitionDto) {
    const actor = await this.requireSystemAdmin(request);

    try {
      return await this.adminConfigService.transitionGoalStatuses(payload, actor);
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Post('review-groups')
  async createReviewGroup(@Req() request: Request, @Body() payload: CreateReviewGroupDto) {
    const actor = await this.requireSystemAdmin(request);
    return this.adminConfigService.createReviewGroup(payload.name, actor);
  }

  @Patch('review-groups/:id')
  async updateReviewGroup(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() payload: UpdateReviewGroupDto
  ) {
    const actor = await this.requireSystemAdmin(request);
    return this.adminConfigService.updateReviewGroup(id, payload.name, actor);
  }

  @Put('review-groups/:id/quotas')
  async updateReviewGroupQuotas(
    @Req() request: Request,
    @Param('id') id: string,
    @Body() payload: UpdateReviewGroupQuotasDto
  ) {
    const actor = await this.requireSystemAdmin(request);

    try {
      await this.adminConfigService.saveReviewGroupQuotas(id, payload.quotas, actor);
      return { ok: true };
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  @Delete('review-groups/:id')
  @HttpCode(200)
  async deleteReviewGroup(@Req() request: Request, @Param('id') id: string) {
    const actor = await this.requireSystemAdmin(request);

    try {
      await this.adminConfigService.deleteReviewGroup(id, actor);
      return { ok: true };
    } catch (error) {
      this.rethrowDomainError(error);
    }
  }

  private async requireSystemAdmin(request: Request): Promise<AuthUser> {
    const sessionId = this.readSessionId(request);
    const session = await this.sessionService.get(sessionId);

    if (!session) {
      throw new UnauthorizedException('authentication required');
    }

    if (session.user.role !== 'system-admin') {
      throw new ForbiddenException('system admin only');
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
