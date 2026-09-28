/**
 * Builds one migrated SQLite template before the suite runs. Each integration
 * test file copies it to its own database file, so files run in parallel with
 * full isolation and no per-test migration cost.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

declare module 'vitest' {
  interface ProvidedContext {
    templateDb: string;
  }
}

const TEST_DB_DIR = path.resolve('.test-db');

export default function setup(project: { provide: (key: 'templateDb', value: string) => void }): () => void {
  rmSync(TEST_DB_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DB_DIR, { recursive: true });
  const template = path.join(TEST_DB_DIR, 'template.db').split(path.sep).join('/');
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: `file:${template}`, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    stdio: 'pipe',
  });
  project.provide('templateDb', template);
  return () => rmSync(TEST_DB_DIR, { recursive: true, force: true });
}
