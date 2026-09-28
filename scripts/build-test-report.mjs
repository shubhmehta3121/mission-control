// Runs the whole test suite and the CLI demo, then writes test-report.html from the real results.
// Nothing in the report is typed by hand except the explanations: counts, names, timings and CLI output
// all come from this run. Run: npm run report
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const target = process.argv[2] ?? 'test-report.html';
const work = mkdtempSync(path.join(tmpdir(), 'mc-report-'));

function run(label, args, env = {}) {
  process.stdout.write(`${label}… `);
  const started = Date.now();
  const result = spawnSync(process.execPath, args, {
    env: { ...process.env, NO_COLOR: '1', ...env },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const seconds = (Date.now() - started) / 1000;
  console.log(`${result.status === 0 ? 'ok' : `exit ${result.status}`} (${seconds.toFixed(1)} s)`);
  return { status: result.status, seconds };
}

const testsFile = path.join(work, 'tests.json');
const demoFile = path.join(work, 'demo.json');
const testRun = run('Running the test suite', ['node_modules/vitest/vitest.mjs', 'run', '--reporter=json', `--outputFile=${testsFile}`]);
const demoRun = run('Running the CLI demo', ['node_modules/tsx/dist/cli.mjs', 'scripts/demo.ts'], { DEMO_LOG: demoFile, DEMO_COLOR: '1' });
const results = JSON.parse(readFileSync(testsFile, 'utf8'));
const demo = JSON.parse(readFileSync(demoFile, 'utf8'));
rmSync(work, { recursive: true, force: true });

const git = (...args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};
const commit = git('rev-parse', '--short', 'HEAD');
// This page is served as-is (raw.githack, a local file), so links to .md files go to GitHub, which renders them.
const remote = git('remote', 'get-url', 'origin').replace(/\.git$/, '').replace(/^git@github\.com:/, 'https://github.com/');
const blobBase = remote.startsWith('https://github.com/') ? `${remote}/blob/${git('rev-parse', '--abbrev-ref', 'HEAD') || 'master'}/` : '';
const onGitHub = (file) => `${blobBase}${file}`;
const dirty = git('status', '--porcelain')
  .split('\n')
  .filter((line) => line.trim() && !line.endsWith(target)).length > 0;

// ── Model ────────────────────────────────────────────────────────────────────

const files = results.testResults
  .map((file) => ({
    path: path.relative(process.cwd(), file.name).split(path.sep).join('/'),
    duration: file.endTime - file.startTime,
    tests: file.assertionResults.map((test) => ({
      group: test.ancestorTitles.join(' › '),
      title: test.title,
      passed: test.status === 'passed',
      duration: test.duration ?? 0,
      failure: (test.failureMessages ?? []).join('\n'),
    })),
  }))
  .sort((a, b) => a.path.localeCompare(b.path));
const allTests = files.flatMap((file) => file.tests.map((test) => ({ ...test, file: file.path })));
const passed = allTests.filter((test) => test.passed).length;
const failed = allTests.length - passed;
const demoSteps = demo.steps.map((step, index) => ({ ...step, number: index + 1, ok: step.exit === step.expectExit }));
const demoOk = demoSteps.filter((step) => step.ok).length;

const LAYERS = [
  {
    id: 'unit',
    title: 'Unit',
    match: /^tests\/unit\//,
    proves:
      'Pure code, no database. The matcher and the seat-assignment solver (Hungarian, checked against brute force), every lifecycle rule for every status × action × role, inclusive date maths, offer deadlines, free-port detection, and the CLI refusing to talk to a server that is not Mission Control.',
  },
  {
    id: 'integration',
    title: 'Integration',
    match: /^tests\/integration\/(?!concurrency)/,
    proves:
      'The real API over HTTP (Fastify inject) on its own migrated SQLite database per file. The full workflow with what each role can see at every step, permissions, tenant isolation down to the database constraints, and the edge cases found in the code audit.',
  },
  {
    id: 'concurrency',
    title: 'Concurrency',
    match: /^tests\/integration\/concurrency/,
    proves:
      'Two requests fired at the same instant. Exactly one wins, the other gets a clean “this changed” error, and no seat is ever double-booked or overwritten (DESIGN.md D21: lock → re-read → compare-and-set).',
  },
  {
    id: 'scenarios',
    title: 'Scenario organisations',
    match: /^tests\/scenarios\//,
    proves:
      'Four deliberately different tenants: Kestrel (3 crew, unfillable seats, a single director), Helios (60 crew, 12 skills, 15 overlapping missions), Aurora (long winter-overs across New Year and 29 February, a 45-day rest gap, 2-day offers), Vanguard (high churn, messy availability, repeated rejections). Plus a six-organisation matrix trying all 30 cross-tenant directions.',
  },
  {
    id: 'property',
    title: 'Randomised invariants',
    match: /^tests\/property\//,
    proves:
      'Generated inputs instead of hand-picked ones, checked against rules that must always hold. Seeds are fixed so failures are reproducible; change them with PROPERTY_SEED or SIM_SEED to explore new cases.',
    invariants: [
      [
        'Matcher, 2,000 random organisations',
        [
          'Every recommended person passes an independently written eligibility check (no matcher code reused).',
          'The eligible set for each role equals the independent implementation’s, and the filter funnel adds up.',
          'Seats filled = the true maximum possible (Kuhn’s matching algorithm).',
          'On small cases, the chosen crew has the best total score (brute force over every combination).',
          'Shuffling the input never changes the answer; scores stay within their bounds; every unfilled seat is explained.',
        ],
      ],
      [
        'Workflow simulation, 500 random API actions across six organisations (clock moving, illegal attempts mixed in)',
        [
          'Nobody has overlapping accepted missions or a rest-gap breach.',
          'No role has more live or accepted seats than its headcount; nobody holds two live seats on one mission.',
          'Missions only move through legal status transitions.',
          'No server errors (5xx); crew are refused approvals, and cross-tenant attempts get 404.',
          'No crew payload ever contains scores or hidden nominations.',
        ],
      ],
    ],
  },
];
for (const file of files) {
  const homes = LAYERS.filter((layer) => layer.match.test(file.path));
  if (homes.length !== 1) throw new Error(`${file.path} belongs to ${homes.length} layers — update LAYERS`);
}

// Each brief requirement → the design section that decides it → the tests (and demo steps) that prove it.
const BRIEF = [
  {
    need: 'Strict multi-tenancy — data never leaks across organisations',
    design: ['7. Tenancy and authentication', '9. Data model'],
    evidence: [['security', /tenant isolation/], ['tenancy-matrix', /./], ['workflow.simulation', /./]],
    tags: ['tenancy'],
  },
  {
    need: 'Three roles; mission leads cannot approve their own missions',
    design: ['8. Roles and permissions'],
    evidence: [['lifecycle', /./], ['security', /authentication|roles and permissions/], ['scenario-orgs', /director's own mission|second director/]],
    tags: ['roles', 'auth'],
  },
  {
    need: 'A mission lifecycle with approval before going active',
    design: ['10. Mission lifecycle', '11. Assignment lifecycle'],
    evidence: [['workflow.test', /happy path|director decisions/], ['edges', /mission lifecycle edges/], ['scenario-orgs', /reject → resubmit/]],
    tags: ['lifecycle'],
  },
  {
    need: 'Crew management — skill profiles, availability, history',
    design: ['9. Data model', '14. Visibility rules (who sees what)'],
    evidence: [['security', /unavailability notes/], ['workflow.test', /block out days/], ['edges', /commitment score|repeated skills/], ['dates-scheduling', /./], ['scenario-orgs', /unavailability/]],
    tags: ['crew'],
  },
  {
    need: 'An auto-matching engine — skills, availability, workload, constraints',
    design: ['12. Matching engine', '3. How real crew assignment works (and what we took from it)'],
    evidence: [['matcher.test', /./], ['hungarian', /./], ['matcher.property', /./], ['scenario-orgs', /explains exactly why|15 overlapping/]],
    tags: ['matcher'],
  },
  {
    need: 'Assignments without double booking — offers, deadlines, drop-outs',
    design: ['13. Offers, deadlines and conflicts', '15. Edge cases handled'],
    evidence: [['workflow.test', /after approval/], ['edges', /responding to offers|deadlines/], ['expiry-ports', /offer deadlines/], ['concurrency', /./], ['scenario-orgs', /Helios|Vanguard/]],
    tags: ['assignments'],
  },
  {
    need: 'Different organisation sizes, skill taxonomies and settings',
    design: ['5. Decision log', '18. Seed data'],
    evidence: [['scenario-orgs', /./], ['security', /organisation settings/], ['edges', /own rest gap/]],
    tags: [],
  },
  {
    need: 'Crew have limited visibility into the organisation',
    design: ['14. Visibility rules (who sees what)'],
    evidence: [['workflow.test', /hiding nominations/], ['edges', /hides nominations|commitment score/], ['security', /limits crew/]],
    tags: ['visibility'],
  },
  {
    need: 'A CLI through which the primary workflows can be exercised',
    design: ['17. CLI'],
    evidence: [['cli-client', /./]],
    tags: '*',
  },
  {
    need: 'Easy to run locally, with representative seed data',
    design: ['18. Seed data'],
    evidence: [['expiry-ports', /free port/], ['cli-client', /which API URL/]],
    tags: ['setup'],
  },
];
const coverage = BRIEF.map((row) => {
  const matched = new Map();
  for (const [file, pattern] of row.evidence) {
    const hits = allTests.filter((test) => test.file.includes(file) && pattern.test(`${test.group} › ${test.title}`));
    if (hits.length === 0) throw new Error(`"${row.need}": no test matches ${file} ${pattern} — update BRIEF`);
    for (const hit of hits) matched.set(`${hit.file}::${hit.group}::${hit.title}`, hit);
  }
  // Demo steps are linked by what they demonstrate (tags in scripts/demo.ts), so adding a step never breaks this.
  const steps = demoSteps.filter((step) => row.tags === '*' || step.tags.some((tag) => row.tags.includes(tag))).map((step) => step.number);
  if (row.tags.length > 0 && steps.length === 0) throw new Error(`"${row.need}": no demo step is tagged ${row.tags} — update BRIEF`);
  const tests = [...matched.values()];
  const byFile = new Map();
  for (const test of tests) byFile.set(test.file, (byFile.get(test.file) ?? 0) + 1);
  return { ...row, steps, tests, byFile, allPassed: tests.every((test) => test.passed) };
});

// ── Rendering ────────────────────────────────────────────────────────────────

const esc = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = (heading) => heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const ms = (value) => (value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.max(1, Math.round(value))} ms`);
const shortFile = (file) => file.replace(/^tests\//, '');
// eslint-disable-next-line no-control-regex
const ANSI = /(\u001b\[[0-9;]*m)/;
const ANSI_COLOURS = { 31: 'red', 32: 'green', 33: 'yellow', 34: 'blue', 35: 'magenta', 36: 'cyan', 90: 'gray' };
const stripAnsi = (text) => text.split(ANSI).filter((part) => !ANSI.test(part)).join('');

/** Renders the CLI's own colour codes, so each step looks exactly as it does in a terminal. */
function ansiToHtml(text) {
  const style = { bold: false, dim: false, italic: false, colour: null };
  let html = '';
  let open = false;
  for (const part of text.split(ANSI)) {
    const codes = /^\u001b\[([0-9;]*)m$/.exec(part);
    if (!codes) {
      html += esc(part);
      continue;
    }
    if (open) html += '</span>';
    open = false;
    for (const code of (codes[1] || '0').split(';').map(Number)) {
      if (code === 0) Object.assign(style, { bold: false, dim: false, italic: false, colour: null });
      else if (code === 1) style.bold = true;
      else if (code === 2) style.dim = true;
      else if (code === 3) style.italic = true;
      else if (code === 22) Object.assign(style, { bold: false, dim: false });
      else if (code === 23) style.italic = false;
      else if (code === 39) style.colour = null;
      else if (ANSI_COLOURS[code]) style.colour = ANSI_COLOURS[code];
    }
    const classes = [style.bold && 'b', style.dim && 'd', style.italic && 'i', style.colour && `c-${style.colour}`].filter(Boolean);
    if (classes.length) {
      html += `<span class="${classes.join(' ')}">`;
      open = true;
    }
  }
  return open ? `${html}</span>` : html;
}

const EXIT_MEANING = { 2: 'needs confirmation', 3: 'not logged in', 4: 'forbidden', 5: 'not found', 6: 'conflict', 7: 'invalid input', 8: 'not Mission Control' };
const refusals = demoSteps.filter((step) => step.expectExit !== 0);
/** The error line a refused person sees (the ✗ line), or the first line of output. */
const firstLine = (output) => {
  const lines = stripAnsi(output).split('\n').map((text) => text.trim()).filter(Boolean);
  const line = lines.find((text) => text.startsWith('✗')) ?? lines[0] ?? '';
  return line.length > 190 ? `${line.slice(0, 187)}…` : line;
};
const pill = (ok, yes = 'passed', no = 'failed') => `<span class="pill ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${ok ? yes : no}</span>`;
const stepList = (numbers) => {
  if (numbers.length === 0) return '<span class="muted">covered by tests only</span>';
  if (numbers.length === demoSteps.length) return `<a href="#demo">all ${numbers.length} steps</a>`;
  return numbers.map((n) => `<a href="#step-${n}">${n}</a>`).join(', ');
};

function renderFile(file) {
  const groups = new Map();
  for (const test of file.tests) groups.set(test.group, [...(groups.get(test.group) ?? []), test]);
  const ok = file.tests.every((test) => test.passed);
  return `
<details class="file" ${ok ? '' : 'open'}>
  <summary><span class="file-name">${esc(shortFile(file.path))}</span><span class="file-meta">${file.tests.length} tests · ${ms(file.duration)}</span>${pill(ok)}</summary>
  ${[...groups]
    .map(
      ([group, tests]) => `
  <div class="group">
    <div class="group-title">${esc(group)}</div>
    <ul class="tests">
      ${tests
        .map(
          (test) => `<li class="${test.passed ? 'ok' : 'bad'}"><span class="mark">${test.passed ? '✓' : '✗'}</span><span class="title">${esc(test.title)}</span><span class="dur">${ms(test.duration)}</span>${
            test.failure ? `<pre class="failure">${esc(test.failure)}</pre>` : ''
          }</li>`,
        )
        .join('\n      ')}
    </ul>
  </div>`,
    )
    .join('')}
</details>`;
}

function renderLayer(layer) {
  const layerFiles = files.filter((file) => layer.match.test(file.path));
  const tests = layerFiles.flatMap((file) => file.tests);
  const ok = tests.every((test) => test.passed);
  return `
<section id="${layer.id}">
  <h2>${esc(layer.title)} <span class="count">${tests.length} tests</span> ${pill(ok)}</h2>
  <p class="lead">${esc(layer.proves)}</p>
  ${
    layer.invariants
      ? `<div class="invariants">${layer.invariants
          .map(([title, items]) => `<div class="card"><h3>${esc(title)}</h3><ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>`)
          .join('')}</div>`
      : ''
  }
  ${layerFiles.map(renderFile).join('')}
</section>`;
}

function renderDemo() {
  const chapters = new Map();
  for (const step of demoSteps) chapters.set(step.chapter, [...(chapters.get(step.chapter) ?? []), step]);
  return [...chapters]
    .map(([chapter, steps]) => {
      const body = steps
        .map((step) => {
          const status = !step.ok
            ? `<span class="expect bad">expected exit ${step.expectExit}, got ${step.exit}</span>`
            : step.expectExit === 0
              ? ''
              : `<span class="expect ok">refused as expected · exit ${step.exit} ${esc(EXIT_MEANING[step.exit] ?? '')}</span>`;
          return `
<div class="step" id="step-${step.number}">
  <div class="bar"><span class="dots"><i></i><i></i><i></i></span><span class="bar-who">${esc(step.person)}</span>${status}<span class="num">#${step.number}</span></div>
  <div class="screen">
    ${step.say ? `<div class="say"># ${esc(step.say)}</div>` : ''}
    <div class="prompt"><span class="ps">$</span> ${esc(step.command)}</div>
    <pre class="term">${ansiToHtml(step.output.replace(/\s+$/, ''))}</pre>
  </div>
</div>`;
        })
        .join('\n');
      const note = steps[0].chapterNote ? `<p class="chapter-note">${esc(steps[0].chapterNote)}</p>` : '';
      return `<details class="chapter" open><summary>${esc(chapter)} <span class="file-meta">${steps.length} steps</span></summary>${note}${body}</details>`;
    })
    .join('\n');
}

function renderRefusals() {
  return `<div class="table-wrap"><table class="refusals">
    <thead><tr><th>#</th><th>Who</th><th>Tried</th><th>What they saw</th><th>Exit</th></tr></thead>
    <tbody>
      ${refusals
        .map(
          (step) => `<tr class="${step.ok ? '' : 'bad'}">
        <td><a href="#step-${step.number}">${step.number}</a></td>
        <td>${esc(step.person)}</td>
        <td><code>${esc(step.command)}</code>${step.say ? `<div class="files">${esc(step.say)}</div>` : ''}</td>
        <td class="saw">${esc(firstLine(step.output))}</td>
        <td>${step.exit} ${esc(EXIT_MEANING[step.exit] ?? '')}${step.ok ? '' : ` (expected ${step.expectExit})`}</td>
      </tr>`,
        )
        .join('\n      ')}
    </tbody>
  </table></div>`;
}

const NOT_COVERED = [
  ['True parallel transactions on Postgres', 'SQLite (via Prisma) runs transactions one at a time, so the concurrency tests prove outcomes, not real interleaving. The locks exist for Postgres; running these suites against Postgres in CI is TODO.md §7.'],
  ['Every CLI flag in isolation', `The ${demoSteps.length}-step demo drives the CLI end to end (including ${refusals.length} refusals) and checks every exit code, and the CLI client has unit tests. There is no per-command suite asserting every flag and --json shape.`],
  ['Performance at scale', 'Tested up to 60 crew and 15 overlapping missions (and 2,000 small random organisations). Not benchmarked at thousands of crew.'],
  ['Features not built yet', 'Backup crew, verified skill ratings, withdrawing a submission, a one-step offer switch and user management (TODO.md §1–5) get their tests when they are built.'],
  ['Identity', 'Seeded API tokens, stored hashed. No SSO, token expiry or rotation yet (TODO.md §4, ROADMAP.md).'],
];

const generatedAt = new Date();
const allGreen = failed === 0 && testRun.status === 0 && demoOk === demoSteps.length && demoRun.status === 0;
const nav = [
  ['summary', 'Summary'],
  ['brief', 'Brief → design → proof'],
  ['refusals', 'Who is refused'],
  ...LAYERS.map((layer) => [layer.id, layer.title]),
  ['demo', 'CLI demo, step by step'],
  ['gaps', 'Not covered yet'],
  ['reproduce', 'Reproduce this report'],
];

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mission Control — Verification Report</title>
<!-- Generated by npm run report from a real test run and CLI demo. Do not edit by hand. -->
<style>
  :root { --bg:#0d1117; --surface:#161b22; --surface-2:#1c2330; --border:#30363d; --text:#e6edf3; --muted:#8b949e; --accent:#58a6ff; --green:#3fb950; --red:#f85149; --amber:#d29922; }
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  pre, .table-wrap { scrollbar-color: #30363d transparent; scrollbar-width: thin; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.6 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .layout { display: flex; max-width: 1440px; margin: 0 auto; }
  nav { position: sticky; top: 0; align-self: flex-start; height: 100vh; overflow-y: auto; width: 250px; flex-shrink: 0; padding: 24px 16px; border-right: 1px solid var(--border); }
  nav h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); margin: 0 0 12px; }
  nav a { display: block; color: var(--text); text-decoration: none; padding: 5px 8px; border-radius: 6px; font-size: 13.5px; }
  nav a:hover { background: var(--surface); color: var(--accent); }
  nav .aside { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); }
  main { flex: 1; padding: 32px 48px 96px; min-width: 0; overflow-wrap: break-word; }
  h1 { font-size: 30px; margin: 0 0 6px; }
  h2 { font-size: 22px; margin: 48px 0 10px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  h3 { font-size: 15px; margin: 0 0 8px; color: var(--accent); }
  a { color: var(--accent); }
  code { background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; font: 13px/1.5 "SF Mono", Consolas, monospace; color: #79c0ff; }
  .muted, .meta { color: var(--muted); }
  .meta { font-size: 13.5px; margin: 0 0 20px; }
  .lead { color: var(--muted); max-width: 900px; margin: 0 0 16px; }
  .count { font-size: 14px; font-weight: 400; color: var(--muted); }
  .pill { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; padding: 2px 9px; border-radius: 999px; white-space: nowrap; }
  .pill.ok { color: var(--green); background: rgba(63,185,80,.12); border: 1px solid rgba(63,185,80,.35); }
  .pill.bad { color: var(--red); background: rgba(248,81,73,.12); border: 1px solid rgba(248,81,73,.35); }
  .banner { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 14px 18px; border-radius: 10px; margin: 18px 0 22px; font-weight: 600; }
  .banner.ok { background: rgba(63,185,80,.1); border: 1px solid rgba(63,185,80,.4); color: var(--green); }
  .banner.bad { background: rgba(248,81,73,.1); border: 1px solid rgba(248,81,73,.4); color: var(--red); }
  .banner span { color: var(--text); font-weight: 400; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 0 0 8px; }
  .stat { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .stat .value { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat .label { font-size: 12.5px; color: var(--muted); }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; font-size: 13.5px; }
  th, td { border: 1px solid var(--border); padding: 9px 11px; text-align: left; vertical-align: top; }
  th { background: var(--surface); font-weight: 600; }
  td.need { font-weight: 600; width: 26%; }
  td .files { color: var(--muted); font-size: 12.5px; margin-top: 3px; }
  .table-wrap { overflow-x: auto; }
  details { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin: 10px 0; }
  summary { cursor: pointer; padding: 11px 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: '▸'; color: var(--muted); transition: transform .15s; }
  details[open] > summary::before { transform: rotate(90deg); }
  .file-name { font: 600 13.5px/1.4 "SF Mono", Consolas, monospace; overflow-wrap: anywhere; min-width: 0; }
  .file-meta { color: var(--muted); font-size: 12.5px; margin-left: auto; font-weight: 400; }
  .group { padding: 4px 16px 10px 36px; }
  .group-title { font-size: 12.5px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; margin: 8px 0 4px; }
  ul.tests { list-style: none; margin: 0; padding: 0; }
  ul.tests li { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 0; border-bottom: 1px solid rgba(48,54,61,.5); font-size: 14px; }
  ul.tests li:last-child { border-bottom: none; }
  ul.tests .mark { width: 14px; flex-shrink: 0; }
  ul.tests li.ok .mark { color: var(--green); }
  ul.tests li.bad .mark, ul.tests li.bad .title { color: var(--red); }
  ul.tests .title { flex: 1; min-width: 200px; }
  ul.tests .dur { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  pre.failure { flex-basis: 100%; white-space: pre-wrap; color: var(--red); background: var(--bg); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
  .invariants { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 12px; margin: 0 0 12px; }
  .card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
  .card ul { margin: 0; padding-left: 18px; font-size: 14px; }
  .card li { margin: 4px 0; }
  .chapter > summary { font-weight: 600; }
  .chapter { padding-bottom: 6px; }
  .chapter-note { margin: 0 16px 6px; color: var(--muted); font-size: 13.5px; }
  .step { margin: 12px 16px 16px; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: #010409; scroll-margin-top: 16px; }
  .step:target { outline: 2px solid var(--accent); outline-offset: 3px; }
  .bar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px; padding: 7px 12px; background: var(--surface-2); border-bottom: 1px solid var(--border); font-size: 12.5px; }
  .dots { display: inline-flex; gap: 6px; }
  .dots i { width: 10px; height: 10px; border-radius: 50%; }
  .dots i:nth-child(1) { background: #f85149; } .dots i:nth-child(2) { background: #d29922; } .dots i:nth-child(3) { background: #3fb950; }
  .bar-who { font-weight: 600; color: #d2a8ff; overflow-wrap: anywhere; min-width: 0; }
  .num { margin-left: auto; color: var(--muted); font-variant-numeric: tabular-nums; }
  .expect { font-size: 12px; padding: 1px 8px; border-radius: 999px; }
  .expect.ok { color: var(--amber); border: 1px solid rgba(210,153,34,.45); }
  .expect.bad { color: var(--red); border: 1px solid rgba(248,81,73,.45); }
  .screen { padding: 10px 14px 12px; font: 12.5px/1.5 "SF Mono", Consolas, monospace; }
  .say { color: #6e7681; }
  .prompt { color: #e6edf3; font-weight: 600; overflow-wrap: anywhere; }
  .prompt .ps { color: #3fb950; }
  pre.term { margin: 4px 0 0; overflow-x: auto; font: inherit; color: #c9d1d9; white-space: pre; }
  pre.term .b { font-weight: 700; color: #f0f6fc; }
  pre.term .d { color: #7d8590; }
  pre.term .i { font-style: italic; }
  pre.term .c-red { color: #ff7b72; } pre.term .c-green { color: #7ee787; } pre.term .c-yellow { color: #e3b341; } pre.term .c-blue { color: #79c0ff; }
  pre.term .c-magenta { color: #d2a8ff; } pre.term .c-cyan { color: #76e3ea; } pre.term .c-gray { color: #7d8590; }
  table.refusals td { font-size: 13px; }
  table.refusals td.saw { font: 12.5px/1.5 "SF Mono", Consolas, monospace; color: #ffa198; }
  table.refusals tr.bad td { background: rgba(248,81,73,.08); }
  .gaps { display: grid; gap: 10px; }
  .gaps .card h3 { color: var(--amber); }
  .gaps .card p { margin: 0; font-size: 14px; color: var(--muted); }
  pre.cmds { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 14px 18px; overflow-x: auto; font: 13px/1.6 "SF Mono", Consolas, monospace; color: #7ee787; }
  @media (max-width: 900px) {
    nav { display: none; }
    main { padding: 24px 16px 64px; }
    .group { padding-left: 16px; }
    .step { margin: 10px 8px 14px; }
  }
</style>
</head>
<body>
<div class="layout">
<nav>
  <h2>Verification report</h2>
  ${nav.map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join('\n  ')}
  <div class="aside"><a href="${onGitHub('SUBMISSION.md')}">Reviewer's guide →</a><a href="design.html">Design document →</a><a href="${onGitHub('README.md')}">README →</a></div>
</nav>
<main>
<section id="summary">
  <h1>Mission Control — Verification Report</h1>
  <p class="meta">Generated ${esc(generatedAt.toISOString().replace('T', ' ').slice(0, 16))} UTC${commit ? ` · commit <code>${esc(commit)}</code>${dirty ? ' + uncommitted changes' : ''}` : ''} · Node ${esc(process.version)} · ${esc(process.platform)} · built by <code>npm run report</code> from a real run: every count, test name, timing and CLI output below comes from that run.</p>
  <div class="banner ${allGreen ? 'ok' : 'bad'}">${allGreen ? '✓ All green.' : '✗ Something failed.'} <span>${passed} of ${allTests.length} automated tests passed, and ${demoOk} of ${demoSteps.length} CLI demo steps behaved as expected, including ${refusals.length} attempts that must be refused.</span></div>
  <div class="stats">
    <div class="stat"><div class="value">${passed}/${allTests.length}</div><div class="label">automated tests passed</div></div>
    <div class="stat"><div class="value">${files.length}</div><div class="label">test files in 5 layers</div></div>
    <div class="stat"><div class="value">${testRun.seconds.toFixed(1)} s</div><div class="label">to run the whole suite</div></div>
    <div class="stat"><div class="value">${demoOk}/${demoSteps.length}</div><div class="label">real CLI steps as expected</div></div>
    <div class="stat"><div class="value">2,000</div><div class="label">random orgs through the matcher</div></div>
    <div class="stat"><div class="value">500</div><div class="label">random workflow actions, invariants checked after each</div></div>
  </div>
</section>

<section id="brief">
  <h2>Brief → design → proof</h2>
  <p class="lead">Each requirement from the challenge brief, the section of the design document that decides how it works, and what proves it. Test counts are computed from this run; the report refuses to build if a requirement points at no tests.</p>
  <div class="table-wrap"><table>
    <thead><tr><th>The brief asks for</th><th>Decided in (design.html)</th><th>Proven by</th><th>CLI demo steps</th></tr></thead>
    <tbody>
      ${coverage
        .map(
          (row) => `<tr>
        <td class="need">${esc(row.need)}</td>
        <td>${row.design.map((heading) => `<a href="design.html#${slug(heading)}">§${esc(heading)}</a>`).join('<br>')}</td>
        <td>${pill(row.allPassed, `${row.tests.length} tests pass`, `${row.tests.filter((t) => !t.passed).length} failing`)}<div class="files">${[...row.byFile]
          .map(([file, count]) => `${esc(shortFile(file))} (${count})`)
          .join(' · ')}</div></td>
        <td>${stepList(row.steps)}</td>
      </tr>`,
        )
        .join('\n      ')}
    </tbody>
  </table></div>
</section>

<section id="refusals">
  <h2>Who is refused, and what they see <span class="count">${refusals.length} attempts</span> ${pill(refusals.every((step) => step.ok), 'all refused as expected', 'not refused as expected')}</h2>
  <p class="lead">Every attempt the rules forbid, taken from the CLI demo below: a lead approving their own mission; crew reaching for the directory, rankings or audit log; a lead doing a director's job; another organisation reaching in; a made-up token; a destructive action without confirmation; and a different app answering on the port. Each is a checked step with the exit code it must produce. Anything outside your organisation is "not found", never "forbidden", so its existence is not revealed.</p>
  ${renderRefusals()}
</section>

${LAYERS.map(renderLayer).join('\n')}

<section id="demo">
  <h2>CLI demo, step by step <span class="count">${demoSteps.length} steps</span> ${pill(demoOk === demoSteps.length, 'all as expected', 'unexpected results')}</h2>
  <p class="lead"><code>npm run demo</code> tells the whole story through the real CLI and API, on a throwaway database built from migrations and seed data: ${new Set(demoSteps.filter((step) => step.org).map((step) => step.who)).size} people in ${new Set(demoSteps.filter((step) => step.org).map((step) => step.org)).size} organisations. Every step declares the exit code it expects, so this is also a smoke test. Each window below is the exact output of this run, colours included: what a person sees in their terminal.</p>
  ${renderDemo()}
</section>

<section id="gaps">
  <h2>Not covered yet</h2>
  <p class="lead">What these tests do not prove, and where it is tracked.</p>
  <div class="gaps">${NOT_COVERED.map(([title, text]) => `<div class="card"><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`).join('')}</div>
</section>

<section id="reproduce">
  <h2>Reproduce this report</h2>
  <pre class="cmds">npm install
npm run setup        # database from migrations + seed data
npm test             # the ${allTests.length} automated tests
npm run demo         # the ${demoSteps.length}-step CLI story
npm run report       # both, rendered into this page
SIM_SEED=77 PROPERTY_SEED=5000 npm test   # explore other random cases</pre>
</section>
</main>
</div>
</body>
</html>
`;

writeFileSync(target, html);
console.log(`wrote ${target}: ${passed}/${allTests.length} tests passed, ${demoOk}/${demoSteps.length} demo steps as expected`);
if (!allGreen) process.exitCode = 1;
