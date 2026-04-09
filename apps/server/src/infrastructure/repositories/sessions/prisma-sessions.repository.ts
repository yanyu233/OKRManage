import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthUser } from '../../../shared/types/auth-user';
import { SessionRecord, SessionsRepository } from './sessions.repository';

@Injectable()
export class PrismaSessionsRepository implements SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, authMethod: string, ttlMinutes: number): Promise<SessionRecord> {
    const activeRoleAssignment = await this.prisma.userRoleAssignment.findFirst({
      where: {
        userId: user.id,
        roleCode: user.role,
        isPrimary: true,
        isEnabled: true
      }
    });

    if (!activeRoleAssignment) {
      throw new UnauthorizedException('missing active role assignment');
    }

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        activeRoleAssignmentId: activeRoleAssignment.id,
        authMethod,
        expiresAt,
        lastSeenAt: new Date()
      }
    });

    return {
      id: session.id,
      user,
      expiresAt: session.expiresAt
    };
  }

  async get(sessionId: string | null): Promise<SessionRecord | null> {
    if (!sessionId) {
      return null;
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            localAccount: true
          }
        },
        activeRoleAssignment: true
      }
    });

    if (!session || !session.user.localAccount) {
      return null;
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastSeenAt: new Date()
      }
    });

    return {
      id: session.id,
      expiresAt: session.expiresAt,
      user: this.toAuthUser(
        session.user.id,
        session.user.name,
        session.activeRoleAssignment.roleCode,
        session.user.localAccount.loginName
      )
    };
  }

  async delete(sessionId: string | null): Promise<void> {
    if (!sessionId) {
      return;
    }

    await this.prisma.session.deleteMany({
      where: { id: sessionId }
    });
  }

  private toAuthUser(id: string, name: string, role: string, loginName: string): AuthUser {
    return {
      id,
      name,
      role,
      loginName
    };
  }
}
