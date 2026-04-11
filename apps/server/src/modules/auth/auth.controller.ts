import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ManualLoginDto } from './dto/manual-login.dto';
import { SwitchActiveRoleDto } from './dto/switch-active-role.dto';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
