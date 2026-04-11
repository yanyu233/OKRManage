import { Injectable } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { AuthUser } from '../../shared/types/auth-user';
import { USERS_REPOSITORY, UsersRepository, WecomMappedUser } from './users.repository';
import { Inject } from '@nestjs/common';

@Injectable()
export class UsersService {
  constructor(@Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository) {}

  async validateLocalDebugUser(loginName: string, password: string): Promise<AuthUser | null> {
    const account = await this.usersRepository.findByLocalLogin(loginName);
    if (!account || !account.localLoginEnabled || !account.isActive) {
      return null;
    }

    const matches = await compare(password, account.passwordHash);
    if (!matches) {
      return null;
    }

    await this.usersRepository.touchLocalLoginSuccess(account.id);

    return {
      id: account.id,
      name: account.name,
      role: account.role,
      activeRole: account.activeRole,
      roles: account.roles,
      loginName: account.loginName
    };
  }

  findById(id: string): Promise<AuthUser | null> {
    return this.usersRepository.findById(id);
  }

  findByWecomUserId(wecomUserId: string): Promise<WecomMappedUser | null> {
    return this.usersRepository.findByWecomUserId(wecomUserId);
  }
}
