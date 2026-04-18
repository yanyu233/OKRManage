import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const appRoot = join(__dirname, '..', '..');
const dbResetScript = join(appRoot, 'scripts', 'db-reset.ps1');
const testProofStorageDir = 'storage/test-proofs';
let prisma: PrismaClient | null = null;

function resolveTestDatabaseUrl() {
  const candidates = [process.env.OKR_E2E_DATABASE_URL, process.env.TEST_DATABASE_URL]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  const databaseUrl = candidates[0];

  if (!databaseUrl) {
    throw new Error(
      'E2E tests require an isolated database. Set OKR_E2E_DATABASE_URL or TEST_DATABASE_URL before running test:e2e.'
    );
  }

  if (databaseUrl.includes('okr_route_c_dev')) {
    throw new Error('Refusing to run e2e tests against okr_route_c_dev. Point OKR_E2E_DATABASE_URL to a dedicated test database.');
  }

  return databaseUrl;
}

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

export async function resetTestDatabase(): Promise<void> {
  const databaseUrl = resolveTestDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  process.env.PROOF_STORAGE_DIR = testProofStorageDir;

  execFileSync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', dbResetScript],
    {
      cwd: appRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        OKR_SKIP_PRISMA_GENERATE: '1',
        OKR_SEED_PROFILE: 'current-demo',
        PROOF_STORAGE_DIR: testProofStorageDir
      }
    }
  );
}

export async function readSessionRows(): Promise<Array<{ id: string; userId: string }>> {
  return getPrisma().session.findMany({
    select: {
      id: true,
      userId: true
    }
  });
}

export async function readAuditRows(action: string): Promise<Array<{ action: string; actorUserId: string | null }>> {
  return getPrisma().auditLog.findMany({
    where: { action },
    select: {
      action: true,
      actorUserId: true
    }
  });
}

export async function closeTestDatabase(): Promise<void> {
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();
  prisma = null;
}
