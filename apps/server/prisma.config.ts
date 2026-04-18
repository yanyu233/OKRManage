import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';

loadEnv();
loadEnv({ path: '.env.local', override: false });

export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts'
  }
});
