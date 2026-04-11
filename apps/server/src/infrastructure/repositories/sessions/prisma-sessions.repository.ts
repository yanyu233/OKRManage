import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthRoleAssignment, AuthUser } from '../../../shared/types/auth-user';
import { SessionRecord, SessionsRepository } from './sessions.repository';

const ROLE_PRIORITY = ['system-admin', 'section-leader', 'group-leader', 'employee'];

@Injectable()
export class PrismaSessionsRepository implements SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: AuthUser, authMethod: string, ttlMinutes: number): Promise<SessionRecord> {
    const activeRoleAssignment = await this.prisma.userRoleAssignment.findFirst({
      where: {
        userId: user.id,
        roleCode: user.role,
        isEnabled: true
      },
      orderBy: [
        { isPrimary: 'desc' },
        { createdAt: 'asc' }
      ]
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

    const session = await this.loadSession(sessionId);
    if (!session) {
      return null;
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastSeenAt: new Date()
      }
    });

    return this.toSessionRecord(session);
  }

  async switchActiveRole(sessionId: string | null, role: string): Promise<SessionRecord> {
    if (!sessionId) {
      throw new UnauthorizedException('authentication required');
    }

    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('authentication required');
    }

    const nextAssignment = session.user.roleAssignments
      .filter((assignment) => assignment.isEnabled && assignment.roleCode === role)
      .sort((left, right) => {
        if (left.isPrimary !== right.isPrimary) {
          return left.isPrimary ? -1 : 1;
        }
        return left.createdAt.getTime() - right.createdAt.getTime();
      })[0];

    if (!nextAssignment) {
      throw new ForbiddenException('target role is not assigned to current user');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        activeRoleAssignmentId: nextAssignment.id,
        lastSeenAt: new Date()
      }
    });

    const refreshed = await this.loadSession(session.id);
    if (!refreshed) {
      throw new UnauthorizedException('authentication required');
    }

    return this.toSessionRecord(refreshed);
  }

  async delete(sessionId: string | null): Promise<void> {
    if (!sessionId) {
      return;
    }

    await this.prisma.session.deleteMany({
      where: { id: sessionId }
    });
  }

  private async loadSession(sessionId: string) {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          include: {
            localAccount: true,
            roleAssignments: {
              where: {
                isEnabled: true
              }
            }
          }
        },
        activeRoleAssignment: true
      }
    });
  }

  private toSessionRecord(session: Awaited<ReturnType<PrismaSessionsRepository['loadSession']>>): SessionRecord {
    if (!session || !session.user.localAccount) {
      throw new UnauthorizedException('authentication required');
    }

    const roles = normalizeRoles(session.user.roleAssignments);

    return {
      id: session.id,
      expiresAt: session.expiresAt,
      user: {
        id: session.user.id,
        name: session.user.name,
        loginName: session.user.localAccount.loginName,
        role: session.activeRoleAssignment.roleCode,
        activeRole: session.activeRoleAssignment.roleCode,
        roles
      }
    };
  }
}

function normalizeRoles(assignments: Array<{ roleCode: string; isPrimary: boolean }>): AuthRoleAssignment[] {
  const byRole = new Map<string, AuthRoleAssignment>();

  for (const assignment of assignments) {
    const current = byRole.get(assignment.roleCode);
    if (!current) {
      byRole.set(assignment.roleCode, {
        role: assignment.roleCode,
        isPrimary: assignment.isPrimary
      });
      continue;
    }

    if (assignment.isPrimary && !current.isPrimary) {
      byRole.set(assignment.roleCode, {
        role: assignment.roleCode,
        isPrimary: true
      });
    }
  }

  return Array.from(byRole.values()).sort((left, right) => {
    const leftPriority = ROLE_PRIORITY.indexOf(left.role);
    const rightPriority = ROLE_PRIORITY.indexOf(right.role);
    return normalizePriority(leftPriority) - normalizePriority(rightPriority);
  });
}

function normalizePriority(index: number) {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
