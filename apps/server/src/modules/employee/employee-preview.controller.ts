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
    @Res({ passthrough: true }) response: Response
  ): Promise<StreamableFile> {
    if (!accessToken || accessToken !== this.runtimeConfig.kkFileViewPreviewToken) {
      throw new UnauthorizedException('invalid preview access token');
    }

    const result = await this.employeeService.getProofPreviewSource(proofId);
    response.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(result.fileName)}"`);
    response.setHeader('Content-Type', 'application/octet-stream');
    return result.file;
  }
}
