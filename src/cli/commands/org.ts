import type { Command } from 'commander';
import { CliError } from '../config.js';
import { c, heading, next, note, out, success, table } from '../ui.js';
import { api, positiveInt, render } from './shared.js';

interface Settings {
  org: string;
  restGapDays: number;
  offerTtlDays: number;
}

interface SkillRow {
  key: string;
  name: string;
  description: string | null;
  holders?: number;
  experts?: number;
}

function renderSettings(settings: Settings): void {
  heading(`${settings.org} settings`);
  out(`  ${'rest-gap-days'.padEnd(16)} ${c.bold(settings.restGapDays)}  ${c.dim('minimum free days between two missions for the same person')}`);
  out(`  ${'offer-ttl-days'.padEnd(16)} ${c.bold(settings.offerTtlDays)}  ${c.dim('days crew have to answer an offer (never later than 14 days before launch)')}`);
}

export function registerOrgCommands(program: Command): void {
  const org = program.command('org').description('organisation settings (directors change them)').helpGroup('Organisation:');
  const settings = org
    .command('settings')
    .description('show settings')
    .action(async (_options: unknown, command: Command) => {
      const current = await api(command).get<Settings>('/v1/org/settings');
      await render(current, () => {
        renderSettings(current);
        next('mc org settings set --rest-gap-days 21');
      });
    });
  settings
    .command('set')
    .description('change settings (directors)')
    .option('--rest-gap-days <days>', 'minimum days between missions', positiveInt('--rest-gap-days'))
    .option('--offer-ttl-days <days>', 'days to answer an offer', positiveInt('--offer-ttl-days'))
    .action(async (options: { restGapDays?: number; offerTtlDays?: number }, command: Command) => {
      if (options.restGapDays === undefined && options.offerTtlDays === undefined) {
        throw new CliError('Pass --rest-gap-days and/or --offer-ttl-days.', 2);
      }
      const updated = await api(command).patch<Settings>('/v1/org/settings', options);
      await render(updated, () => {
        success('Settings updated.');
        renderSettings(updated);
      });
    });

  const skills = program.command('skills').description("the organisation's skill taxonomy").helpGroup('Organisation:');
  skills
    .command('list', { isDefault: true })
    .alias('ls')
    .description('every skill, with how many crew hold it')
    .action(async (_options: unknown, command: Command) => {
      const list = await api(command).get<SkillRow[]>('/v1/skills');
      await render(list, () => {
        heading('Skills');
        table(
          [
            { header: 'KEY', value: (skill: SkillRow) => c.bold(skill.key) },
            { header: 'NAME', value: (skill) => skill.name },
            ...(list.some((skill) => skill.holders !== undefined)
              ? [
                  { header: 'HOLDERS', value: (skill: SkillRow) => String(skill.holders ?? ''), align: 'right' as const },
                  { header: 'LEVEL 4+', value: (skill: SkillRow) => String(skill.experts ?? ''), align: 'right' as const },
                ]
              : []),
            { header: 'DESCRIPTION', value: (skill) => c.dim(skill.description ?? ''), max: 40 },
          ],
          list,
        );
        note('Use keys in role specs, e.g. --role "Pilot:1:nav=4".');
      });
    });
  skills
    .command('add')
    .description('add a skill to the taxonomy (directors)')
    .argument('<key>', 'short handle, e.g. "nav"')
    .argument('<name...>', 'display name')
    .option('-d, --description <text>')
    .action(async (key: string, name: string[], options: { description?: string }, command: Command) => {
      const skill = await api(command).post<SkillRow>('/v1/skills', { key, name: name.join(' '), ...(options.description ? { description: options.description } : {}) });
      await render(skill, () => success(`Added ${c.bold(skill.key)} ${skill.name}.`));
    });
}
