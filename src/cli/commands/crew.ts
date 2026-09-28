import type { Command } from 'commander';
import type { OfferView } from '../../services/offers.js';
import type { PersonView } from '../../services/people.js';
import type { InboxItem } from '../../services/inbox.js';
import { badge, bar, c, heading, next, note, out, plural, relative, shortDate, success, sym, table, warning, window } from '../ui.js';
import { api, confirm, parseSkillLevel, render } from './shared.js';
import { roleLabel } from './session.js';

export function registerInboxCommand(program: Command): void {
  program
    .command('inbox')
    .description('what needs you right now (reviews, crew gaps, offers, updates)')
    .helpGroup('Getting started:')
    .action(async (_options: unknown, command: Command) => {
      const inbox = await api(command).get<{ name: string; role: string; org: string; items: InboxItem[] }>('/v1/inbox');
      await render(inbox, () => {
        heading('Inbox', [inbox.name, roleLabel(inbox.role), inbox.org].join(` ${sym.dot} `));
        if (inbox.items.length === 0) {
          success('Nothing needs you right now.');
          return;
        }
        for (const item of inbox.items) {
          const marker = item.urgency === 'action' ? c.cyan(sym.filled) : c.dim(sym.open);
          out(`  ${marker} ${item.urgency === 'action' ? c.bold(item.title) : item.title}`);
          if (item.detail) out(`    ${item.kind === 'OFFER' && item.detail.startsWith('Cannot') ? c.yellow(item.detail) : c.dim(item.detail)}${item.kind === 'OFFER' && item.at && !item.detail.startsWith('Cannot') ? c.dim(` (${relative(item.at)})`) : ''}`);
          if (item.next) out(`    ${c.cyan(`${sym.arrow} ${item.next}`)}`);
          out();
        }
      });
    });
}

export function registerOfferCommands(program: Command): void {
  const offers = program
    .command('offers')
    .description('your offers: accept, decline, drop out (crew)')
    .helpGroup('Crew:');

  offers
    .command('list', { isDefault: true })
    .alias('ls')
    .description('every offer you have received')
    .action(async (_options: unknown, command: Command) => {
      const list = await api(command).get<OfferView[]>('/v1/me/offers');
      await render(list, () => {
        heading('Your offers', plural(list.length, 'offer'));
        if (list.length === 0) {
          note('No offers yet. You will see them here once a director approves a mission you were nominated for.');
          return;
        }
        table(
          [
            { header: 'KEY', value: (offer: OfferView) => c.bold(offer.key) },
            { header: 'MISSION', value: (offer) => offer.title, max: 28 },
            { header: 'SEAT', value: (offer) => (offer.kind === 'BACKUP' ? `backup · ${offer.role}` : offer.role) },
            { header: 'STATUS', value: (offer) => badge(offer.status) },
            { header: 'WINDOW', value: (offer) => window(offer) },
            {
              header: 'NOTE',
              value: (offer) =>
                offer.blocked
                  ? c.yellow(`${sym.warn} ${offer.blocked.replace(/^Cannot accept: /, "can't accept: ")}`)
                  : offer.status === 'OFFERED'
                    ? `respond by ${shortDate(offer.expiresAt)} ${c.dim(`(${relative(offer.expiresAt)})`)}`
                    : c.dim(offer.reason ?? ''),
            },
          ],
          list,
        );
        const open = list.find((offer) => offer.status === 'OFFERED' && !offer.blocked);
        if (open) next(`mc offers accept ${open.key}`, `mc offers decline ${open.key} --reason "…"`, `mc missions show ${open.key}`);
      });
    });

  offers
    .command('accept')
    .description('take the seat')
    .argument('<key>', 'mission key, e.g. AST-7')
    .action(async (key: string, _options: unknown, command: Command) => {
      const result = await api(command).post<{ key: string; role: string; crewComplete: boolean }>(`/v1/me/offers/${encodeURIComponent(key)}/accept`);
      await render(result, () => {
        out();
        success(`You're on ${c.bold(result.key)} as ${result.role}.`);
        note(result.crewComplete ? 'The crew is now complete. You will see your crewmates once the mission goes active.' : 'Your crewmates are revealed once the whole crew is confirmed and the mission goes active.');
      });
    });

  offers
    .command('decline')
    .description('turn the seat down (does not count against you)')
    .argument('<key>')
    .option('--reason <text>', 'optional, shared with the mission lead')
    .action(async (key: string, options: { reason?: string }, command: Command) => {
      const result = await api(command).post<{ key: string }>(`/v1/me/offers/${encodeURIComponent(key)}/decline`, options.reason ? { reason: options.reason } : {});
      await render(result, () => {
        success(`Declined ${result.key}. The mission lead will find someone else.`);
      });
    });

  offers
    .command('drop')
    .description('withdraw from a seat you already accepted')
    .argument('<key>')
    .requiredOption('--reason <text>', 'shared with the mission lead')
    .option('-y, --yes', 'skip the confirmation prompt')
    .action(async (key: string, options: { reason: string; yes?: boolean }, command: Command) => {
      await confirm(`Drop out of ${key}? The lead will have to refill your seat, and drop-outs count on your commitment record.`, options.yes);
      const result = await api(command).post<{ key: string }>(`/v1/me/offers/${encodeURIComponent(key)}/drop`, { reason: options.reason });
      await render(result, () => success(`You've left ${result.key}. The mission lead has been told the seat is open.`));
    });
}

function renderPerson(person: PersonView & { role?: string }, self: boolean): void {
  heading(person.name, `@${person.handle}${person.role ? ` ${sym.dot} ${roleLabel(person.role)}` : ''} ${sym.dot} ${person.email}`);
  out(`  ${c.dim('Skills')}${person.skills.length ? '' : c.dim('  none yet')}`);
  for (const skill of person.skills) out(`    ${bar(skill.level / 5)} ${skill.level}  ${skill.name} ${c.dim(`(${skill.key})`)}`);
  out();
  out(`  ${c.dim('Unavailable')}${person.unavailable.length ? '' : c.dim('  nothing blocked out')}`);
  for (const window_ of person.unavailable) {
    out(`    ${window_.startDate} ${sym.arrow} ${window_.endDate}${'note' in window_ && window_.note ? c.dim(`  ${window_.note}`) : ''}${self ? c.dim(`  id ${window_.id}`) : ''}`);
  }
  out();
  out(`  ${c.dim('Upcoming')}${person.upcoming.length ? '' : c.dim('  no confirmed missions')}`);
  for (const mission of person.upcoming) out(`    ${c.bold(mission.key)} ${mission.title} ${c.dim(`as ${mission.role} · ${mission.startDate} → ${mission.endDate}`)}`);
  out();
  out(`  ${c.dim('Record')}  ${plural(person.record.completedMissions, 'completed mission')} ${c.dim(sym.dot)} ${person.record.accepts} accepted ${c.dim(sym.dot)} ${person.record.dropouts} dropped${person.record.commitment === undefined ? '' : ` ${c.dim(sym.dot)} commitment ${person.record.commitment.toFixed(2)}`}`);
}

export function registerPeopleCommands(program: Command): void {
  const crew = program.command('crew').description('the crew directory (leads and directors)').helpGroup('Organisation:');
  crew
    .command('list', { isDefault: true })
    .alias('ls')
    .description('everyone, or who holds a skill')
    .option('--skill <key>', 'only crew with this skill')
    .option('--min <level>', 'minimum level for --skill', '1')
    .action(async (options: { skill?: string; min: string }, command: Command) => {
      const query = options.skill ? `?skill=${encodeURIComponent(options.skill)}&min=${encodeURIComponent(options.min)}` : '';
      const people = await api(command).get<PersonView[]>(`/v1/crew${query}`);
      await render(people, () => {
        heading('Crew', plural(people.length, 'person', 'people'));
        table(
          [
            { header: 'HANDLE', value: (person: PersonView) => c.bold(person.handle) },
            { header: 'NAME', value: (person) => person.name },
            { header: 'SKILLS', value: (person) => person.skills.map((skill) => `${skill.key} ${skill.level}`).join(', '), max: 40 },
            { header: 'NEXT MISSION', value: (person) => (person.upcoming[0] ? `${person.upcoming[0].key} ${c.dim(person.upcoming[0].startDate)}` : c.dim('—')) },
            { header: 'AWAY', value: (person) => (person.unavailable[0] ? c.dim(`${person.unavailable[0].startDate} → ${person.unavailable[0].endDate}`) : '') },
          ],
          people,
        );
        next('mc crew show <handle>');
      });
    });
  crew
    .command('show')
    .description("a crew member's skills, availability, commitments and record")
    .argument('<handle>')
    .action(async (handle: string, _options: unknown, command: Command) => {
      const person = await api(command).get<PersonView>(`/v1/crew/${encodeURIComponent(handle)}`);
      await render(person, () => renderPerson(person, false));
    });

  const profile = program
    .command('profile')
    .description('your own skills and availability')
    .helpGroup('Crew:')
    .action(async (_options: unknown, command: Command) => {
      const me = await api(command).get<PersonView & { role: string }>('/v1/me/profile');
      await render(me, () => {
        renderPerson(me, true);
        next('mc profile skills set nav=4 eva=3', 'mc profile unavailable add <start> <end> --note "…"');
      });
    });

  const skills = profile.command('skills').description('rate your own skills (1–5)');
  skills
    .command('set')
    .description('set one or more skill levels, e.g. nav=5 eva=3')
    .argument('<skill=level...>')
    .action(async (entries: string[], _options: unknown, command: Command) => {
      const me = await api(command).put<PersonView>('/v1/me/skills', { skills: entries.map(parseSkillLevel) });
      await render(me, () => {
        success('Skills updated.');
        for (const skill of me.skills) out(`    ${bar(skill.level / 5)} ${skill.level}  ${skill.name}`);
      });
    });
  skills
    .command('remove')
    .description('remove a skill from your profile')
    .argument('<skill>')
    .action(async (key: string, _options: unknown, command: Command) => {
      const me = await api(command).delete<PersonView>(`/v1/me/skills/${encodeURIComponent(key)}`);
      await render(me, () => success(`Removed ${key}.`));
    });

  const unavailable = profile.command('unavailable').description('block out days you cannot fly');
  unavailable
    .command('list', { isDefault: true })
    .description('your upcoming blocked-out days')
    .action(async (_options: unknown, command: Command) => {
      const list = await api(command).get<PersonView['unavailable']>('/v1/me/unavailability');
      await render(list, () => {
        heading('Unavailable');
        if (list.length === 0) note('Nothing blocked out.');
        for (const window_ of list) out(`  ${window_.startDate} ${sym.arrow} ${window_.endDate}  ${c.dim(('note' in window_ && window_.note) || '')}  ${c.dim(`id ${window_.id}`)}`);
      });
    });
  unavailable
    .command('add')
    .description('block out a date range (inclusive)')
    .argument('<start>', 'YYYY-MM-DD')
    .argument('<end>', 'YYYY-MM-DD')
    .option('--note <text>', 'private: only you and directors see it')
    .action(async (start: string, end: string, options: { note?: string }, command: Command) => {
      const created = await api(command).post<{ id: string; startDate: string; endDate: string }>('/v1/me/unavailability', {
        startDate: start,
        endDate: end,
        ...(options.note ? { note: options.note } : {}),
      });
      await render(created, () => {
        success(`Blocked out ${created.startDate} ${sym.arrow} ${created.endDate}. The matcher will not suggest you for missions overlapping it.`);
      });
    });
  unavailable
    .command('remove')
    .description('remove a blocked-out range')
    .argument('<id>')
    .action(async (id: string, _options: unknown, command: Command) => {
      const result = await api(command).delete<{ removed: string }>(`/v1/me/unavailability/${encodeURIComponent(id)}`);
      await render(result, () => success('Removed.'));
    });
}

