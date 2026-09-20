import { env } from './config/env';
import { connectDatabase } from './config/db';
import { logger } from './config/logger';
import { createApp } from './app';
import { seedIfEmpty } from './seed';
import { ensureSystemRoles } from './services/role.service';

async function bootstrap() {
  await connectDatabase();
  await ensureSystemRoles();
  await seedIfEmpty();
  const app = createApp();
  app.listen(env.port, () => {
    logger.info(`API listening on http://localhost:${env.port}`);
    logger.info(`Swagger UI at http://localhost:${env.port}/api/docs`);
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
