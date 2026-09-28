import type { Command } from 'commander';
import { call } from '../client.js';
import { CliError, defaultApiUrl, findProfileName, loadConfig, resolveProfile, saveConfig } from '../config.js';
import { c, heading, next, note, out, success, sym, table } from '../ui.js';
import { api, globals, render } from './shared.js';

interface Me {
  handle: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  org: { slug: string; name: string; keyPrefix: string };
}

const FIRST_STEP: Record<string, string> = {
  DIRECTOR: 'mc inbox',
  MISSION_LEAD: 'mc inbox',
  CREW_MEMBER: 'mc offers',
};

export function registerSessionCommands(program: Command): void {
  program
    .command('login')
    .description('save an API token as a profile and switch to it')
    .argument('<token>', 'API token (printed by `npm run seed`)')
    .option('--as <name>', 'profile name (default: <handle>@<org>)')
    .option('--api <url>', 'API base URL', defaultApiUrl())
    .helpGroup('Getting started:')
    .action(async (token: string, options: { as?: string; api: string }) => {
      const me = await call<Me>({ apiUrl: options.api, token }, 'GET', '/v1/me');
      const name = options.as ?? `${me.handle}@${me.org.slug}`;
      const config = loadConfig();
      config.profiles[name] = {
        token,
        apiUrl: options.api,
        handle: me.handle,
        name: me.name,
        role: me.role,
        org: me.org.name,
        orgSlug: me.org.slug,
      };
      config.current = name;
      saveConfig(config);
      await render({ profile: name, ...me }, () => {
        out();
        success(`Logged in as ${c.bold(me.name)} ${c.dim(sym.dot)} ${me.roleLabel} ${c.dim(sym.dot)} ${me.org.name}`);
        note(`Profile ${name} is now active. Switch identities any time with \`mc use <profile>\`.`);
        next(FIRST_STEP[me.role] ?? 'mc inbox');
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
            note('No profiles yet. Log in with `mc login <token>` (tokens are printed by `npm run seed`).');
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
    .description('show who you are acting as')
    .helpGroup('Getting started:')
    .action(async (_options: unknown, command: Command) => {
      const resolved = resolveProfile(globals(command).profile);
      const me = await api(command).get<Me>('/v1/me');
      await render({ profile: resolved.name, apiUrl: resolved.profile.apiUrl, ...me }, () => {
        out();
        out(`  ${c.bold(me.name)} ${c.dim(`@${me.handle}`)}  ${me.roleLabel} ${c.dim(sym.dot)} ${me.org.name} ${c.dim(`[${me.org.keyPrefix}]`)}`);
        note(`profile ${resolved.name} ${sym.dot} ${resolved.profile.apiUrl}`);
      });
    });
}

export function roleLabel(role: string): string {
  return { DIRECTOR: 'Director', MISSION_LEAD: 'Mission Lead', CREW_MEMBER: 'Crew Member' }[role] ?? role;
}
