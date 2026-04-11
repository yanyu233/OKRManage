import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ManualLoginDto } from './dto/manual-login.dto';
import { SwitchActiveRoleDto } from './dto/switch-active-role.dto';
import { WecomCallbackQueryDto } from './dto/wecom-callback-query.dto';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('auth/start')
  start(@Req() request: Request) {
    return this.authService.start(request);
  }

  @Get('auth/wecom/start')
  wecomStart(@Req() request: Request, @Res() response: Response) {
    return this.authService.wecomStart(request, response);
  }

  @Get('auth/wecom/callback')
  wecomCallback(
    @Query() query: WecomCallbackQueryDto,
    @Req() request: Request,
    @Res() response: Response
  ) {
    return this.authService.wecomCallback(query, request, response);
  }

  @Post('auth/manual-login')
  @HttpCode(200)
  login(@Body() payload: ManualLoginDto, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(payload.loginName, payload.password, response);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.logout(request, response);
  }

  @Post('auth/active-role')
  @HttpCode(200)
  switchActiveRole(@Req() request: Request, @Body() payload: SwitchActiveRoleDto) {
    return this.authService.switchActiveRole(request, payload.role);
  }

  @Get('me')
  me(@Req() request: Request) {
    return this.authService.getCurrentUser(request);
  }
}
