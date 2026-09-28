/**
 * npm run demo — the whole Mission Control story, end to end, through the real
 * CLI and API, against a throwaway database. Your dev database and CLI profiles
 * are untouched.
 *
 * It doubles as a smoke test: every step declares the exit code it expects,
 * and the script exits non-zero if anything behaves differently. The refusals
 * (a lead approving their own mission, crew browsing the directory, another
 * organisation reaching in…) are steps too, so they are checked on every run.
 *
 * DEMO_LOG=<file> also writes every step as JSON, and DEMO_COLOR=1 captures the
 * CLI's colours even when this script's output is not a terminal (both used by
 * `npm run report`).
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/http/app.js';

const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const childColor = color || process.env.DEMO_COLOR === '1';
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

// Stands in for another app on the port (e.g. a Next.js dev server) to show the CLI noticing.
const impostor = createServer((_request, response) => {
  response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end('<!DOCTYPE html><html><body>404</body></html>');
});
await new Promise<void>((resolve) => impostor.listen(0, '127.0.0.1', () => resolve()));
const impostorUrl = `http://127.0.0.1:${(impostor.address() as AddressInfo).port}`;

const PEOPLE: Record<string, { org: string; label: string }> = {
  marcus: { org: 'astra', label: 'Marcus Chen · Mission Lead · Astra Dynamics' },
  priya: { org: 'astra', label: 'Priya Nair · Mission Lead · Astra Dynamics' },
  ava: { org: 'astra', label: 'Ava Sterling · Director · Astra Dynamics' },
  jamal: { org: 'astra', label: 'Jamal Reyes · Crew · Astra Dynamics' },
  leo: { org: 'astra', label: 'Leo Vasquez · Crew · Astra Dynamics' },
  yuki: { org: 'astra', label: 'Yuki Tanaka · Crew · Astra Dynamics' },
  sara: { org: 'astra', label: 'Sara Lindqvist · Crew · Astra Dynamics' },
  owen: { org: 'lunar', label: 'Owen Park · Mission Lead · Lunar Collective (another tenant)' },
  nora: { org: 'lunar', label: 'Nora Hale · Director · Lunar Collective (another tenant)' },
  stranger: { org: '', label: 'Someone with a made-up token' },
};

/** What a step demonstrates; the report uses these to link steps to the brief. */
type Tag = 'setup' | 'cli' | 'auth' | 'roles' | 'tenancy' | 'lifecycle' | 'crew' | 'matcher' | 'assignments' | 'visibility';

interface StepOptions {
  expectExit?: number;
  say?: string;
  tags?: Tag[];
  /** Token to send; `null` = none, so the CLI uses the saved profiles (login chapter). Default: the person's seeded token. */
  token?: string | null;
  env?: NodeJS.ProcessEnv;
}

let current = '';
let currentChapter = { title: '', note: '' };
let steps = 0;
const failures: string[] = [];
const log: Array<{
  chapter: string;
  chapterNote: string;
  who: string;
  org: string;
  person: string;
  command: string;
  say?: string;
  tags: Tag[];
  expectExit: number;
  exit: number | null;
  output: string;
}> = [];

function chapter(title: string, note = ''): void {
  currentChapter = { title, note };
  console.log(`\n\n${bold(`▌ ${title}`)}`);
  if (note) console.log(dim(`  ${note}`));
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

async function step(who: string, args: string[], options: StepOptions = {}): Promise<void> {
  const expectExit = options.expectExit ?? 0;
  const person = PEOPLE[who]!;
  if (who !== current) {
    console.log(`\n${cyan(`━━ ${person.label} ━━`)}`);
    current = who;
  }
  if (options.say) console.log(dim(`   # ${options.say}`));
  const shown = args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(' ');
  console.log(`${bold('$')} mc ${shown}`);
  const token = options.token === undefined ? `mct_${person.org}_${who}` : options.token;
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MC_API_URL: apiUrl,
    MC_CONFIG_DIR: dir,
    FORCE_COLOR: childColor ? '1' : '0',
    ...options.env,
  };
  delete childEnv.MC_PROFILE; // a profile set in the caller's shell would override the step's identity
  delete childEnv.MC_TOKEN;
  if (!childColor) childEnv.NO_COLOR = '1';
  else delete childEnv.NO_COLOR;
  if (token) childEnv.MC_TOKEN = token;
  const result = await runCli(args, childEnv);
  process.stdout.write(result.output);
  steps += 1;
  log.push({
    chapter: currentChapter.title,
    chapterNote: currentChapter.note,
    who,
    org: person.org,
    person: person.label,
    command: `mc ${shown}`,
    say: options.say,
    tags: options.tags ?? [],
    expectExit,
    exit: result.status,
    output: result.output,
  });
  if (result.status !== expectExit) {
    failures.push(`mc ${shown} (as ${who}) exited ${result.status}, expected ${expectExit}`);
    console.log(red(`   ✗ expected exit ${expectExit}, got ${result.status}`));
  } else if (expectExit !== 0) {
    console.log(dim(`   (exit ${result.status}, as expected)`));
  }
}

try {
  chapter('0 · Getting started: log in, check the connection, switch identities', 'These steps use saved profiles, exactly as a person at a terminal would.');
  await step('marcus', ['--help'], { token: null, tags: ['cli'], say: 'Commands are grouped by who uses them; `mc <command> --help` adds examples' });
  await step('marcus', ['login', 'mct_astra_marcus'], { token: null, tags: ['setup', 'cli'], say: 'Tokens are printed by `npm run setup`; `mc login` on its own prompts for one' });
  await step('ava', ['login', 'mct_astra_ava'], { token: null, tags: ['setup', 'cli'] });
  await step('ava', ['profiles'], { token: null, tags: ['cli'], say: 'One profile per identity' });
  await step('marcus', ['use', 'marcus'], { token: null, tags: ['cli'], say: 'Switching identities is instant' });
  await step('marcus', ['whoami'], { token: null, tags: ['cli'] });
  await step('marcus', ['doctor'], { token: null, tags: ['setup', 'cli'], say: 'Which server, is it really Mission Control, and who am I' });
  await step('marcus', ['doctor'], {
    token: null,
    env: { MC_API_URL: impostorUrl },
    expectExit: 8,
    tags: ['setup', 'cli'],
    say: 'Another app answering on the port (say, a Next.js dev server): a clear message, not a crash',
  });
  await step('stranger', ['whoami'], { token: 'mct_astra_nobody', expectExit: 3, tags: ['auth'], say: 'A made-up token gets nowhere' });

  chapter('1 · A lead plans the crew — the matcher explains every choice', 'From here on, each step runs as the person named, as if they had run `mc use <person>`.');
  await step('marcus', ['inbox'], { tags: ['lifecycle'] });
  await step('marcus', ['missions', 'match', 'AST-6'], { tags: ['matcher'] });
  await step('marcus', ['missions', 'match', 'AST-6', '--explain', 'elena'], { tags: ['matcher'], say: 'Why isn’t Elena on it?' });
  await step('marcus', ['missions', 'nominate', 'AST-6', '--recommended'], { tags: ['matcher', 'lifecycle'] });
  await step('marcus', ['missions', 'submit', 'AST-6'], { tags: ['lifecycle'] });
  await step('marcus', ['missions', 'approve', 'AST-6'], { expectExit: 4, tags: ['roles'], say: 'A lead cannot approve their own mission — only a director can' });

  chapter('2 · The director reviews the plan and the named crew');
  await step('ava', ['inbox'], { tags: ['lifecycle'] });
  await step('ava', ['missions', 'show', 'AST-6'], { tags: ['lifecycle', 'roles'], say: 'The plan and the named crew, with scores' });
  await step('ava', ['missions', 'approve', 'AST-6', '--note', 'Good crew. Go.'], { tags: ['lifecycle', 'roles'] });
  await step('ava', ['missions', 'reject', 'AST-8', '--note', 'Navigator must also be EVA-qualified; add it and resubmit.'], { tags: ['lifecycle', 'roles'] });

  chapter('3 · Crew respond — several offers are fine, double booking is not');
  await step('jamal', ['offers'], { tags: ['assignments', 'visibility'] });
  await step('jamal', ['offers', 'accept', 'AST-6'], { tags: ['assignments'] });
  await step('jamal', ['offers', 'accept', 'AST-7'], { expectExit: 6, tags: ['assignments'], say: 'AST-7 overlaps the mission he just accepted' });
  await step('priya', ['inbox'], { tags: ['visibility', 'assignments'], say: 'The other lead learns the seat is blocked — but not why' });
  await step('priya', ['missions', 'retract', 'AST-7', 'jamal'], { tags: ['assignments'] });
  await step('leo', ['offers', 'accept', 'AST-6'], { tags: ['assignments'] });
  await step('yuki', ['offers', 'accept', 'AST-6'], { tags: ['assignments'] });

  chapter('4 · A drop-out after approval: repair the seat, not the mission');
  await step('yuki', ['offers', 'drop', 'AST-6', '--reason', 'Medical hold', '--yes'], { tags: ['assignments', 'crew'] });
  await step('marcus', ['inbox'], { tags: ['assignments'] });
  await step('marcus', ['missions', 'match', 'AST-6'], { tags: ['matcher'], say: 'Nobody qualifies — the matcher says exactly why, and who is close' });
  await step('sara', ['profile', 'skills', 'set', 'nav=4'], { tags: ['crew'], say: 'Sara completes her navigation recertification' });
  await step('marcus', ['missions', 'offer', 'AST-6', '--recommended'], { tags: ['matcher', 'assignments'] });
  await step('sara', ['offers', 'accept', 'AST-6'], { tags: ['assignments'] });

  chapter('5 · Lock the crew; the roster is revealed to them');
  await step('marcus', ['missions', 'activate', 'AST-6'], { tags: ['lifecycle'] });
  await step('leo', ['missions', 'show', 'AST-6'], { tags: ['visibility'], say: 'Crew see their crewmates only once the mission is active' });

  chapter('6 · Who is refused, and what they see', 'Every refusal names the rule. Anything outside your organisation is "not found", never "forbidden", so its existence is not revealed.');
  await step('leo', ['crew'], { expectExit: 4, tags: ['roles', 'visibility'], say: 'Crew cannot browse the crew directory' });
  await step('leo', ['missions', 'match', 'AST-6'], { expectExit: 4, tags: ['roles', 'visibility'], say: 'Crew never see rankings or scores' });
  await step('leo', ['missions', 'history', 'AST-6'], { expectExit: 4, tags: ['roles', 'visibility'], say: 'The audit log is for leads and directors' });
  await step('priya', ['missions', 'complete', 'AST-6'], { expectExit: 4, tags: ['roles'], say: 'Another lead’s mission is not hers to change' });
  await step('marcus', ['missions', 'cancel', 'AST-7', '--reason', 'Budget cut', '--yes'], { expectExit: 4, tags: ['roles'], say: 'Only directors cancel missions' });
  await step('marcus', ['org', 'settings', 'set', '--rest-gap-days', '7'], { expectExit: 4, tags: ['roles'], say: 'Only directors change organisation settings' });
  await step('jamal', ['offers', 'drop', 'AST-6', '--reason', 'Changed my mind'], {
    expectExit: 2,
    tags: ['crew', 'cli'],
    say: 'Destructive actions confirm first: a terminal asks “Drop out of AST-6? … [y/N]”; a script must pass --yes',
  });
  await step('owen', ['missions', 'show', 'AST-6'], { expectExit: 5, tags: ['tenancy'], say: 'Another organisation cannot even see that AST-6 exists' });
  await step('owen', ['crew', 'show', 'leo'], { expectExit: 5, tags: ['tenancy'], say: '…or look up Astra’s people' });
  await step('nora', ['missions', 'cancel', 'AST-7', '--reason', 'Not ours', '--yes'], { expectExit: 5, tags: ['tenancy', 'roles'], say: 'Even another organisation’s director cannot touch it' });
  await step('marcus', ['missions', 'history', 'AST-6'], { tags: ['lifecycle'], say: 'Every change, by whom and when' });
} finally {
  await app.close();
  await db.$disconnect();
  await new Promise<void>((resolve) => impostor.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
  if (process.env.DEMO_LOG) writeFileSync(process.env.DEMO_LOG, JSON.stringify({ steps: log, failures }, null, 2));
}

console.log('');
if (failures.length > 0) {
  console.log(red(`✗ ${failures.length} of ${steps} steps behaved unexpectedly:`));
  for (const failure of failures) console.log(red(`  - ${failure}`));
  process.exit(1);
}
console.log(green(`✓ Demo complete: ${steps} CLI steps, all behaved as expected.`));
