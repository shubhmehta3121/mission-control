/**
 * npm run demo — the whole Mission Control story, end to end, through the real
 * CLI and API, against a throwaway database. Your dev database and CLI profiles
 * are untouched.
 *
 * It doubles as a smoke test: every step declares the exit code it expects,
 * and the script exits non-zero if anything behaves differently.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/http/app.js';

const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: number) => (text: string) => (color ? `\u001b[${code}m${text}\u001b[0m` : text);
const bold = paint(1);
const dim = paint(2);
const cyan = paint(36);
const red = paint(31);
const green = paint(32);

const dir = mkdtempSync(path.join(tmpdir(), 'mc-demo-'));
const databaseUrl = `file:${path.join(dir, 'demo.db').split(path.sep).join('/')}`;
const env = { ...process.env, DATABASE_URL: databaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: '1' };

console.log(dim('Preparing a throwaway database (migrate + seed)…'));
execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { env, stdio: 'pipe' });
execFileSync(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), 'prisma/seed.ts'], { env, stdio: 'pipe' });

const db = new PrismaClient({ datasourceUrl: databaseUrl });
const app = buildApp({ db });
const apiUrl = await app.listen({ port: 0, host: '127.0.0.1' });

const PEOPLE: Record<string, { org: string; label: string }> = {
  marcus: { org: 'astra', label: 'Marcus Chen · Mission Lead · Astra Dynamics' },
  priya: { org: 'astra', label: 'Priya Nair · Mission Lead · Astra Dynamics' },
  ava: { org: 'astra', label: 'Ava Sterling · Director · Astra Dynamics' },
  jamal: { org: 'astra', label: 'Jamal Reyes · Crew · Astra Dynamics' },
  leo: { org: 'astra', label: 'Leo Vasquez · Crew · Astra Dynamics' },
  yuki: { org: 'astra', label: 'Yuki Tanaka · Crew · Astra Dynamics' },
  sara: { org: 'astra', label: 'Sara Lindqvist · Crew · Astra Dynamics' },
  owen: { org: 'lunar', label: 'Owen Park · Mission Lead · Lunar Collective (another tenant)' },
};

let current = '';
let steps = 0;
const failures: string[] = [];

function chapter(title: string): void {
  console.log(`\n\n${bold(`▌ ${title}`)}`);
}

/** The API runs in this process, so the CLI must be spawned asynchronously (a sync spawn would deadlock). */
function runCli(args: string[], childEnv: NodeJS.ProcessEnv): Promise<{ status: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve('bin/mc.mjs'), ...args], { env: childEnv });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString('utf8')));
    child.on('error', reject);
    child.on('close', (status) => resolve({ status, output }));
  });
}

async function step(who: string, args: string[], options: { expectExit?: number; say?: string } = {}): Promise<void> {
  const expectExit = options.expectExit ?? 0;
  const person = PEOPLE[who]!;
  if (who !== current) {
    console.log(`\n${cyan(`━━ ${person.label} ━━`)}`);
    current = who;
  }
  if (options.say) console.log(dim(`   # ${options.say}`));
  const shown = args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ');
  console.log(`${bold('$')} mc ${shown}`);
  const result = await runCli(args, {
    ...process.env,
    MC_TOKEN: `mct_${person.org}_${who}`,
    MC_API_URL: apiUrl,
    MC_CONFIG_DIR: dir,
    FORCE_COLOR: color ? '1' : '0',
    ...(color ? {} : { NO_COLOR: '1' }),
  });
  process.stdout.write(result.output);
  steps += 1;
  if (result.status !== expectExit) {
    failures.push(`mc ${shown} (as ${who}) exited ${result.status}, expected ${expectExit}`);
    console.log(red(`   ✗ expected exit ${expectExit}, got ${result.status}`));
  } else if (expectExit !== 0) {
    console.log(dim(`   (exit ${result.status}, as expected)`));
  }
}

try {
  chapter('1 · A lead plans the crew — the matcher explains every choice');
  await step('marcus', ['inbox']);
  await step('marcus', ['missions', 'match', 'AST-6']);
  await step('marcus', ['missions', 'match', 'AST-6', '--explain', 'elena'], { say: 'Why isn’t Elena on it?' });
  await step('marcus', ['missions', 'nominate', 'AST-6', '--recommended']);
  await step('marcus', ['missions', 'submit', 'AST-6']);

  chapter('2 · The director reviews the plan and the named crew');
  await step('ava', ['inbox']);
  await step('ava', ['missions', 'show', 'AST-6'], { say: 'The plan and the named crew, with scores' });
  await step('ava', ['missions', 'approve', 'AST-6', '--note', 'Good crew. Go.']);
  await step('ava', ['missions', 'reject', 'AST-8', '--note', 'Navigator must also be EVA-qualified; add it and resubmit.']);

  chapter('3 · Crew respond — several offers are fine, double booking is not');
  await step('jamal', ['offers']);
  await step('jamal', ['offers', 'accept', 'AST-6']);
  await step('jamal', ['offers', 'accept', 'AST-7'], { expectExit: 6, say: 'AST-7 overlaps the mission he just accepted' });
  await step('priya', ['inbox'], { say: 'The other lead learns the seat is blocked — but not why' });
  await step('priya', ['missions', 'retract', 'AST-7', 'jamal']);
  await step('leo', ['offers', 'accept', 'AST-6']);
  await step('yuki', ['offers', 'accept', 'AST-6']);

  chapter('4 · A drop-out after approval: repair the seat, not the mission');
  await step('yuki', ['offers', 'drop', 'AST-6', '--reason', 'Medical hold', '--yes']);
  await step('marcus', ['inbox']);
  await step('marcus', ['missions', 'match', 'AST-6'], { say: 'Nobody qualifies — the matcher says exactly why, and who is close' });
  await step('sara', ['profile', 'skills', 'set', 'nav=4'], { say: 'Sara completes her navigation recertification' });
  await step('marcus', ['missions', 'offer', 'AST-6', '--recommended']);
  await step('sara', ['offers', 'accept', 'AST-6']);

  chapter('5 · Lock the crew; the roster is revealed to them');
  await step('marcus', ['missions', 'activate', 'AST-6']);
  await step('leo', ['missions', 'show', 'AST-6']);

  chapter('6 · Tenancy and audit');
  await step('owen', ['missions', 'show', 'AST-6'], { expectExit: 5, say: 'Another organisation cannot even see that AST-6 exists' });
  await step('marcus', ['missions', 'history', 'AST-6']);
} finally {
  await app.close();
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
}

console.log('');
if (failures.length > 0) {
  console.log(red(`✗ ${failures.length} of ${steps} steps behaved unexpectedly:`));
  for (const failure of failures) console.log(red(`  - ${failure}`));
  process.exit(1);
}
console.log(green(`✓ Demo complete: ${steps} CLI steps, all behaved as expected.`));
