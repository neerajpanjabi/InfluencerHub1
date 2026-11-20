#!/usr/bin/env node
/**
 * Creates local development config files with freshly generated secrets.
 * Cross-platform (Windows/macOS/Linux). Never overwrites existing files.
 *   apps/api/.env            API + worker settings (sandbox providers ON, demo data ON)
 *   packages/database/.env   DATABASE_URL + seed settings
 */
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB = process.env.DATABASE_URL ?? 'postgresql://influencehub:influencehub@localhost:5432/influencehub?schema=public';

const api = `APP_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:3000
API_PUBLIC_URL=http://localhost:3000/api/v1
DATABASE_URL=${DB}
REDIS_URL=redis://localhost:6379
QUEUE_ENABLED=true
JWT_SECRET=${randomBytes(48).toString('base64')}
ENCRYPTION_KEY=${randomBytes(32).toString('base64')}
SOCIAL_SANDBOX_ENABLED=true
PAYMENT_PROVIDER=sandbox
SANDBOX_WEBHOOK_SECRET=${randomBytes(24).toString('hex')}
LLM_PROVIDER=none
SMS_PROVIDER=console
STORAGE_DRIVER=local
UPLOAD_DIR=./storage/uploads
`;
const db = `DATABASE_URL=${DB}
SEED_DEMO_DATA=true
SEED_ADMIN_EMAIL=admin@influencehub.local
SEED_ADMIN_PASSWORD=AdminPass2026!
`;

for (const [rel, content] of [['apps/api/.env', api], ['packages/database/.env', db]]) {
  const p = join(root, rel);
  if (existsSync(p)) console.log(`• ${rel} already exists — left unchanged`);
  else {
    writeFileSync(p, content);
    console.log(`✔ created ${rel}`);
  }
}
