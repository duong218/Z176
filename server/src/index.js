import { createApp } from './app.js';
import { assertRuntimeEnv, env } from './config/env.js';
import { connectDatabase } from './config/db.js';
import { runStartupSeed } from './services/seed.service.js';

async function main() {
  assertRuntimeEnv();
  await connectDatabase();

  const seedResult = await runStartupSeed({ includeAdmin: env.seedOnStart });
  if (env.seedOnStart && seedResult.adminResult.seeded) {
    // eslint-disable-next-line no-console -- startup only, no secrets
    console.info(
      `[seed] Admin created: username="${seedResult.adminResult.username}" mustChangePassword=${seedResult.adminResult.mustChangePassword}`,
    );
  } else if (env.seedOnStart && !seedResult.adminResult.seeded) {
    // eslint-disable-next-line no-console
    console.warn(
      `[seed] Admin not created (${seedResult.adminResult.reason}). Set ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD in server/.env — see .env.example`,
    );
  }

  const app = createApp();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console -- startup banner only
    console.info(`[server] listening on port ${env.port} (${env.nodeEnv})`);
    // eslint-disable-next-line no-console
    console.info(`[server] login rate limit is ${env.isProduction ? 'ENABLED' : 'DISABLED (dev mode)'}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] failed to start:', err.message);
  process.exit(1);
});
