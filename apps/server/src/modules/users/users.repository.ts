import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../shared/types/auth-user';

interface LocalDebugAccount extends AuthUser {
  password: string;
}

@Injectable()
export class UsersRepository {
  private readonly accounts: LocalDebugAccount[] = [
    {
      id: 'u-sysadmin-debug',
      name: '严主任',
      role: 'system-admin',
      loginName: 'sysadmin.local',
      password: 'Admin123!'
    }
  ];

  findByLoginName(loginName: string): LocalDebugAccount | undefined {
    const normalized = loginName.trim().toLowerCase();
    return this.accounts.find((account) => account.loginName.toLowerCase() === normalized);
  }

  toAuthUser(account: LocalDebugAccount): AuthUser {
    const { password: _password, ...user } = account;
    return user;
  }
}
