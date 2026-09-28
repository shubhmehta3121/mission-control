/**
 * mc — the Mission Control CLI. A pure API client: every rule is enforced by
 * the server; the CLI renders results, suggests the next step, and maps
 * failures to meaningful exit codes.
 */
import { Command, CommanderError } from 'commander';
import { CliError } from './config.js';
import { c, configureOutput, isJson, json, sym } from './ui.js';
import { registerMissionCommands } from './commands/missions.js';
import { registerInboxCommand, registerOfferCommands, registerPeopleCommands } from './commands/crew.js';
import { registerOrgCommands } from './commands/org.js';
import { registerSessionCommands } from './commands/session.js';

const program = new Command();

program
  .name('mc')
  .description('Mission Control — plan missions, match crew, run approvals.')
  .option('--json', 'machine-readable output (raw API JSON)')
  .option('-p, --profile <name>', 'run this one command as another saved profile')
  .option('--no-color', 'disable colours')
  .showHelpAfterError(c.dim('(run with --help for usage)'))
  .exitOverride()
  .hook('preAction', (thisCommand) => {
    const options = thisCommand.opts<{ json?: boolean; color?: boolean }>();
    configureOutput({ json: options.json, color: options.color });
  })
  .addHelpText(
    'after',
    `
Quick start:
  npm run setup && npm run dev        # API starts on :3000, or the next free port
  mc doctor                           # is the CLI talking to Mission Control?
  mc login mct_astra_marcus           # a mission lead at Astra Dynamics
  mc inbox                            # what needs you
  mc missions match AST-6             # who should crew it, and why
  mc use ava@astra                    # switch to the director

The CLI finds a local API automatically, even if it moved off a busy port.
Override with MC_API_URL, or pin a profile with mc login --api <url>.

Exit codes: 0 ok · 2 usage · 3 not logged in · 4 forbidden · 5 not found
            6 state conflict / not ready · 7 invalid input · 8 API unreachable / not Mission Control`,
  );

registerSessionCommands(program);
registerInboxCommand(program);
registerMissionCommands(program);
registerOfferCommands(program);
registerPeopleCommands(program);
registerOrgCommands(program);

function fail(error: CliError): never {
  if (isJson()) {
    json({ error: { code: error.code ?? 'CLI_ERROR', message: error.message, ...(error.details ? { details: error.details } : {}) } });
  } else {
    const code = error.code ? `${c.dim(error.code)}  ` : '';
    process.stderr.write(`\n  ${c.red(sym.fail)} ${code}${error.message}\n`);
    const blockers = (error.details as { blockers?: string[] } | undefined)?.blockers ?? [];
    for (const line of blockers) process.stderr.write(`      ${c.dim(sym.bullet)} ${line}\n`);
    process.stderr.write('\n');
  }
  process.exit(error.exitCode);
}

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if (error instanceof CommanderError) {
    // Help and version exit cleanly; usage mistakes exit 2.
    process.exit(error.exitCode === 0 || error.code === 'commander.helpDisplayed' || error.code === 'commander.help' ? 0 : 2);
  }
  if (error instanceof CliError) fail(error);
  fail(new CliError(error instanceof Error ? error.message : String(error), 1));
}
