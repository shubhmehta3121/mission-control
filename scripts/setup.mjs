// One-command local setup: create .env if missing, then rebuild the dev database
// from migrations and load the demo seed (prisma migrate reset runs the seed).
import { copyFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Created .env from .env.example');
}
execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
