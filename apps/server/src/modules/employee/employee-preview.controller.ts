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
import { EmployeeService } from './employee.service';
import { buildInlineContentDisposition } from '../../shared/http/content-disposition';
import { getProofContentType } from '../../shared/proof/proof-links';

@Controller('internal')
export class EmployeePreviewController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly runtimeConfig: RuntimeConfigService
  ) {}

  @Get('proofs/:proofId/source')
  async getProofSource(
    @Param('proofId') proofId: string,
    @Query('accessToken') accessToken: string | undefined,
    @Query('entryPath') entryPath: string | undefined,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    if (!accessToken || accessToken !== this.runtimeConfig.kkFileViewPreviewToken) {
      throw new UnauthorizedException('invalid preview access token');
    }

    const result = await this.employeeService.getProofPreviewSource(proofId, entryPath);
    response.setHeader('Content-Disposition', buildInlineContentDisposition(result.fileName));
    response.setHeader('Content-Type', getProofContentType(result.fileName) ?? 'application/octet-stream');
    return result.file;
  }

  @Get('proofs/:proofId/preview')
  async openProofPreview(
    @Param('proofId') proofId: string,
    @Query('accessToken') accessToken: string | undefined,
    @Query('entryPath') entryPath: string | undefined,
    @Res() response: Response
  ) {
    if (!accessToken || accessToken !== this.runtimeConfig.kkFileViewPreviewToken) {
      throw new UnauthorizedException('invalid preview access token');
    }

    const targetUrl = await this.employeeService.resolveProofDirectPreviewUrl(proofId, entryPath);
    return response.redirect(targetUrl);
  }

  @Get('proofs/:proofId/pdf-preview')
  async getProofPdfPreview(
    @Param('proofId') proofId: string,
    @Query('accessToken') accessToken: string | undefined,
    @Query('entryPath') entryPath: string | undefined,
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    if (!accessToken || accessToken !== this.runtimeConfig.kkFileViewPreviewToken) {
      throw new UnauthorizedException('invalid preview access token');
    }

    const result = await this.employeeService.getProofPdfPreviewSource(proofId, entryPath);
    response.setHeader('Content-Disposition', buildInlineContentDisposition(result.fileName));
    response.setHeader('Content-Type', 'application/pdf');
    return result.file;
  }
}
