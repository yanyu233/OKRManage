import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../shared/types/auth-user';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  validateLocalDebugUser(loginName: string, password: string): AuthUser | null {
    const account = this.usersRepository.findByLoginName(loginName);
    if (!account || account.password !== password) {
      return null;
    }

    return this.usersRepository.toAuthUser(account);
  }
}
