import { Logger } from '@nestjs/common';
import { env } from './config/env';
import { createApp } from './bootstrap';

async function main() {
  const app = await createApp();
  await app.listen(env().PORT);
  Logger.log(`InfluenceHub API listening on :${env().PORT} (${env().APP_ENV})`, 'Bootstrap');
}
main();
