import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const appRoot = join(__dirname, '..', '..');
const dbResetScript = join(appRoot, 'scripts', 'db-reset.ps1');

export async function resetTestDatabase(): Promise<void> {
  execFileSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', dbResetScript],
    {
      cwd: appRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        OKR_SKIP_PRISMA_GENERATE: '1'
      }
    }
  );
}

export async function readSessionRows(): Promise<Array<{ id: string; userId: string }>> {
  return prisma.session.findMany({
    select: {
      id: true,
      userId: true
    }
  });
}

export async function readAuditRows(action: string): Promise<Array<{ action: string; actorUserId: string | null }>> {
  return prisma.auditLog.findMany({
    where: { action },
    select: {
      action: true,
      actorUserId: true
    }
  });
}

export async function closeTestDatabase(): Promise<void> {
  await prisma.$disconnect();
}
