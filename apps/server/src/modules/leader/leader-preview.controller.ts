import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  StreamableFile,
  UnauthorizedException
} from '@nestjs/common';
import { Response } from 'express';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { buildInlineContentDisposition } from '../../shared/http/content-disposition';
import { getProofContentType } from '../../shared/proof/proof-links';
import { LeaderService } from './leader.service';

@Controller('internal')
export class LeaderPreviewController {
  constructor(
    private readonly leaderService: LeaderService,
    private readonly runtimeConfig: RuntimeConfigService
  ) {}

  @Get('knowledge-assets/:assetId/source')
  async getKnowledgeAssetSource(
    @Param('assetId') assetId: string,
    @Query('accessToken') accessToken: string | undefined,
    @Query('entryPath') entryPath: string | undefined,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    if (!accessToken || accessToken !== this.runtimeConfig.kkFileViewPreviewToken) {
      throw new UnauthorizedException('invalid preview access token');
    }

    const result = await this.leaderService.getManualKnowledgeAssetPreviewSource(assetId, entryPath);
    response.setHeader('Content-Disposition', buildInlineContentDisposition(result.fileName));
    response.setHeader('Content-Type', getProofContentType(result.fileName) ?? 'application/octet-stream');
    return result.file;
  }
}
