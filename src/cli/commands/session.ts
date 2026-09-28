import { createInterface } from 'node:readline/promises';
import type { Command } from 'commander';
import type { getMe } from '../../services/org.js';
import { call, checkHealth } from '../client.js';
import { CliError, findProfileName, loadConfig, resolveApiUrl, resolveProfile, saveConfig } from '../config.js';
import { c, heading, next, note, out, success, sym, table, warning } from '../ui.js';
import { api, globals, render } from './shared.js';

type Me = Awaited<ReturnType<typeof getMe>>;

const FIRST_STEP: Record<Me['role'], string> = {
  DIRECTOR: 'mc inbox',
  MISSION_LEAD: 'mc inbox',
  CREW_MEMBER: 'mc offers',
};

/** Token from the argument, or pasted at a prompt / piped on stdin (keeps it out of shell history). */
async function readToken(argument?: string): Promise<string> {
  if (argument?.trim()) return argument.trim();
  if (process.stdin.isTTY) {
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = (await prompt.question('  API token: ')).trim();
      if (answer) return answer;
    } finally {
      prompt.close();
    }
  } else {
    let piped = '';
    for await (const chunk of process.stdin) piped += String(chunk);
    if (piped.trim()) return piped.trim();
  }
  throw new CliError('No token given. Run `mc login <token>` (tokens are printed by `npm run setup`).', 2);
}

export function registerSessionCommands(program: Command): void {
  program
    .command('login')
    .description('save an API token as a profile and switch to it')
    .argument('[token]', 'API token printed by `npm run setup` (omit it to paste it at a prompt)')
    .option('--as <name>', 'profile name (default: <handle>@<org>)')
    .option('--api <url>', 'pin this profile to an API URL (default: find the local server automatically)')
    .helpGroup('Getting started:')
    .action(async (tokenArgument: string | undefined, options: { as?: string; api?: string }) => {
      const token = await readToken(tokenArgument);
      const url = options.api ?? resolveApiUrl().url; // an explicit --api beats MC_API_URL here: it is what gets saved
      await checkHealth(url); // refuse to save a profile against something that isn't Mission Control
      const me = await call<Me>({ apiUrl: url, token }, 'GET', '/v1/me');
      const name = options.as ?? `${me.handle}@${me.org.slug}`;
      const config = loadConfig();
      config.profiles[name] = {
        token,
        ...(options.api ? { apiUrl: options.api } : {}),
        handle: me.handle,
        name: me.name,
        role: me.role,
        org: me.org.name,
        orgSlug: me.org.slug,
      };
      config.current = name;
      saveConfig(config);
      await render({ profile: name, apiUrl: url, ...me }, () => {
        out();
        success(`Logged in as ${c.bold(me.name)} ${c.dim(sym.dot)} ${me.roleLabel} ${c.dim(sym.dot)} ${me.org.name}`);
        note(`Profile ${name} is now active (API ${url}). Switch identities any time with \`mc use <profile>\`.`);
        next(FIRST_STEP[me.role]);
      });
    });

  program
    .command('use')
    .description('switch the active profile (a unique prefix is enough: `mc use marcus`)')
    .argument('<profile>')
    .helpGroup('Getting started:')
    .action(async (query: string) => {
      const config = loadConfig();
      const name = findProfileName(config, query);
      config.current = name;
      saveConfig(config);
      const profile = config.profiles[name]!;
      await render({ profile: name, ...profile, token: undefined }, () => {
        success(`Now acting as ${c.bold(profile.name)} ${c.dim(`(${roleLabel(profile.role)}, ${profile.org})`)}`);
      });
    });

  program
    .command('profiles')
    .description('list saved profiles')
    .helpGroup('Getting started:')
    .action(async () => {
      const config = loadConfig();
      const rows = Object.entries(config.profiles).map(([profileName, profile]) => ({
        profileName,
        ...profile,
        current: profileName === config.current,
      }));
      await render(
        rows.map(({ token: _token, ...rest }) => rest),
        () => {
          if (rows.length === 0) {
            out();
            note('No profiles yet. Log in with `mc login <token>` (tokens are printed by `npm run setup`).');
            return;
          }
          heading('Profiles');
          table(
            [
              { header: '', value: (row) => (row.current ? c.green(sym.filled) : ' ') },
              { header: 'PROFILE', value: (row) => (row.current ? c.bold(row.profileName) : row.profileName) },
              { header: 'NAME', value: (row) => row.name },
              { header: 'ROLE', value: (row) => roleLabel(row.role) },
              { header: 'ORGANISATION', value: (row) => row.org },
            ],
            rows,
          );
          next('mc use <profile>');
        },
      );
    });

  program
    .command('logout')
    .description('forget a profile (default: the active one)')
    .argument('[profile]')
    .helpGroup('Getting started:')
    .action(async (query?: string) => {
      const config = loadConfig();
      const name = query ? findProfileName(config, query) : config.current;
      if (!name || !config.profiles[name]) throw new CliError('No active profile to log out of.', 3);
      delete config.profiles[name];
      if (config.current === name) delete config.current;
      saveConfig(config);
      await render({ removed: name }, () => success(`Removed profile ${name}.`));
    });

  program
    .command('whoami')
    .description('show who you are acting as, and which server')
    .helpGroup('Getting started:')
    .action(async (_options: unknown, command: Command) => {
      const resolved = resolveProfile(globals(command).profile);
      const me = await api(command).get<Me>('/v1/me');
      await render({ profile: resolved.name, apiUrl: resolved.apiUrl, apiSource: resolved.apiSource, ...me }, () => {
        out();
        out(`  ${c.bold(me.name)} ${c.dim(`@${me.handle}`)}  ${me.roleLabel} ${c.dim(sym.dot)} ${me.org.name} ${c.dim(`[${me.org.keyPrefix}]`)}`);
        note(`profile ${resolved.name} ${sym.dot} ${resolved.apiUrl} (${resolved.apiSource})`);
      });
    });

  program
    .command('doctor')
    .description('check the CLI can reach Mission Control and who you are logged in as')
    .helpGroup('Getting started:')
    .action(async (_options: unknown, command: Command) => {
      let target: { url: string; source: string; profile: string | null; token: string | null };
      try {
        const resolved = resolveProfile(globals(command).profile);
        target = { url: resolved.apiUrl, source: resolved.apiSource, profile: resolved.name, token: resolved.token };
      } catch {
        const fallback = resolveApiUrl();
        target = { url: fallback.url, source: fallback.source, profile: null, token: null };
      }
      const report: {
        apiUrl: string;
        apiSource: string;
        profile: string | null;
        server: Awaited<ReturnType<typeof checkHealth>> | null;
        serverError: string | null;
        login: Me | null;
        loginError: string | null;
      } = { apiUrl: target.url, apiSource: target.source, profile: target.profile, server: null, serverError: null, login: null, loginError: null };
      try {
        report.server = await checkHealth(target.url);
        if (target.token) report.login = await call<Me>({ apiUrl: target.url, token: target.token }, 'GET', '/v1/me');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (report.server) report.loginError = message;
        else report.serverError = message;
      }
      await render(report, () => {
        heading('Mission Control doctor');
        out(`  ${c.dim('API')}  ${report.apiUrl} ${c.dim(`(${report.apiSource})`)}`);
        if (report.serverError) {
          out(`  ${c.red(sym.fail)} ${report.serverError}`);
          return;
        }
        success(`Server is Mission Control ${report.server?.version ?? ''} and healthy.`);
        if (report.login) success(`Logged in as ${report.login.name} (${report.login.roleLabel}, ${report.login.org.name}) via profile ${report.profile}.`);
        else if (report.loginError) out(`  ${c.red(sym.fail)} ${report.loginError}`);
        else warning('Not logged in. Run `mc login <token>` (tokens are printed by `npm run setup`).');
      });
      if (report.serverError) process.exitCode = 8;
      else if (report.loginError) process.exitCode = 3;
    });
}

export function roleLabel(role: string): string {
  return { DIRECTOR: 'Director', MISSION_LEAD: 'Mission Lead', CREW_MEMBER: 'Crew Member' }[role] ?? role;
}
