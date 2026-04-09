import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { USERS_REPOSITORY } from './users.repository';
import { PrismaUsersRepository } from '../../infrastructure/repositories/users/prisma-users.repository';

@Module({
  providers: [
    UsersService,
    PrismaUsersRepository,
    {
      provide: USERS_REPOSITORY,
      useExisting: PrismaUsersRepository
    }
  ],
  exports: [UsersService]
})
export class UsersModule {}
