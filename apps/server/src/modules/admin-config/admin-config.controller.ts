import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException
} from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from '../session/session.service';
import { AuthUser } from '../../shared/types/auth-user';
import { DomainValidationError } from '../../shared/errors/domain-validation.error';
import { AdminConfigService } from './admin-config.service';
import { CreateReviewGroupDto } from './dto/create-review-group.dto';
import { SaveOrgBootstrapDto } from './dto/save-org-bootstrap.dto';
import { UpdateReviewGroupDto } from './dto/update-review-group.dto';
import { UpdateReviewGroupQuotasDto } from './dto/update-review-group-quotas.dto';

@Controller('admin')
export class AdminConfigController {
  constructor(
    private readonly adminConfigService: AdminConfigService,
    private readonly sessionService: SessionService
  ) {}

  @Get('org/bootstrap')
  async getBootstrap(@Req() request: Request) {
    await this.requireSystemAdmin(request);
    return this.adminConfigService.getBootstrap();
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
