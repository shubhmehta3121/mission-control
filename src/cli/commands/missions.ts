import type { Command } from 'commander';
import type { MissionSummary, MissionView, SeatView } from '../../services/missions.js';
import type { MatchResponse, StaffingResult } from '../../services/staffing.js';
import type { RankedCandidate, ScoreBreakdown } from '../../matcher/types.js';
import { CliError } from '../config.js';
import {
  badge,
  bar,
  c,
  heading,
  next,
  note,
  out,
  plural,
  relative,
  score,
  shortDate,
  success,
  sym,
  table,
  visibleLength,
  warning,
  window,
} from '../ui.js';
import { api, collect, confirm, parseRoleSpec, render } from './shared.js';

const path = (key: string, suffix = '') => `/v1/missions/${encodeURIComponent(key)}${suffix}`;

export function registerMissionCommands(program: Command): void {
  const missions = program
    .command('missions')
    .alias('m')
    .description('plan, staff and run missions')
    .helpGroup('Missions:');

  missions
    .command('list')
    .alias('ls')
    .description('missions you can see (crew: missions you were offered)')
    .option('-s, --status <statuses>', 'filter, e.g. draft,approved')
    .option('--mine', 'only missions you own')
    .action(async (options: { status?: string; mine?: boolean }, command: Command) => {
      const query = new URLSearchParams();
      if (options.status) query.set('status', options.status);
      if (options.mine) query.set('mine', 'true');
      const list = await api(command).get<MissionSummary[]>(`/v1/missions${query.size ? `?${query}` : ''}`);
      await render(list, () => renderList(list));
    });

  missions
    .command('show')
    .description('details, crew, review status and what you can do next')
    .argument('<key>', 'mission key, e.g. AST-6 (or just 6)')
    .action(async (key: string, _options: unknown, command: Command) => {
      const mission = await api(command).get<MissionView>(path(key));
      await render(mission, renderMission);
    });

  missions
    .command('create')
    .description('create a draft mission')
    .requiredOption('-t, --title <title>', 'mission title')
    .requiredOption('--start <date>', 'first day, YYYY-MM-DD')
    .requiredOption('--end <date>', 'last day (inclusive), YYYY-MM-DD')
    .option('-d, --description <text>', 'one-line description')
    .option('-r, --role <spec>', 'role as name:headcount:skill=min,… (repeatable)', collect, [])
    .addHelpText('after', '\nExample:\n  mc missions create -t "Europa Survey" --start 2026-11-01 --end 2026-11-30 \\\n    --role "Pilot:1:nav=4" --role "Flight Engineer:1:eva=4,comms=3"')
    .action(async (options: { title: string; start: string; end: string; description?: string; role: string[] }, command: Command) => {
      const mission = await api(command).post<MissionView>('/v1/missions', {
        title: options.title,
        startDate: options.start,
        endDate: options.end,
        ...(options.description ? { description: options.description } : {}),
        ...(options.role.length ? { roles: options.role.map(parseRoleSpec) } : {}),
      });
      await render(mission, () => {
        out();
        success(`Created ${c.bold(mission.key)} ${mission.title} ${c.dim(`(${mission.status})`)}`);
        renderMission(mission);
      });
    });

  missions
    .command('edit')
    .description('change title, description or dates (draft or changes-requested only)')
    .argument('<key>')
    .option('-t, --title <title>')
    .option('-d, --description <text>')
    .option('--start <date>')
    .option('--end <date>')
    .action(async (key: string, options: { title?: string; description?: string; start?: string; end?: string }, command: Command) => {
      const body = {
        ...(options.title ? { title: options.title } : {}),
        ...(options.description !== undefined ? { description: options.description } : {}),
        ...(options.start ? { startDate: options.start } : {}),
        ...(options.end ? { endDate: options.end } : {}),
      };
      if (Object.keys(body).length === 0) throw new CliError('Nothing to change. Pass --title, --description, --start or --end.', 2);
      const mission = await api(command).patch<MissionView>(path(key), body);
      await render(mission, () => {
        out();
        success(`Updated ${mission.key}.`);
        if (options.start || options.end) note('Nominees are re-checked against the new dates when you submit.');
        renderMission(mission);
      });
    });

  missions
    .command('roles')
    .description('define the seats a mission needs')
    .command('set')
    .description('replace all roles (clears existing nominations)')
    .argument('<key>')
    .requiredOption('-r, --role <spec>', 'role as name:headcount:skill=min,… (repeatable)', collect, [])
    .action(async (key: string, options: { role: string[] }, command: Command) => {
      const result = await api(command).put<MissionView & { clearedNominations: number }>(path(key, '/roles'), {
        roles: options.role.map(parseRoleSpec),
      });
      await render(result, () => {
        out();
        success(`Roles set on ${result.key}.`);
        if (result.clearedNominations > 0) warning(`Cleared ${plural(result.clearedNominations, 'nomination')} — nominate again.`);
        renderMission(result);
      });
    });

  missions
    .command('match')
    .description('run the matcher (dry run): recommended crew, ranked alternatives, and why')
    .argument('<key>')
    .option('-e, --explain <handle>', 'why (or why not) this person, role by role')
    .option('-a, --all', 'show every eligible candidate (default: top 5 per role)')
    .action(async (key: string, options: { explain?: string; all?: boolean }, command: Command) => {
      const query = options.explain ? `?explain=${encodeURIComponent(options.explain)}` : '';
      const response = await api(command).get<MatchResponse>(path(key, `/match${query}`));
      await render(response, () => (response.explanation ? renderExplanation(response) : renderMatch(response, options.all ?? false)));
    });

  missions
    .command('nominate')
    .description('put crew forward for a draft (hidden from crew until a director approves)')
    .argument('<key>')
    .option('--recommended', "take the matcher's recommended crew for every open seat")
    .option('--role <name>', 'role to fill (with --crew)')
    .option('--crew <handle>', 'crew member to nominate (with --role)')
    .option('--reset', 'clear existing nominations first')
    .action(async (key: string, options: { recommended?: boolean; role?: string; crew?: string; reset?: boolean }, command: Command) => {
      const result = await api(command).post<StaffingResult>(path(key, '/nominations'), seatBody(options));
      await render(result, () => renderStaffing(result, 'Nominated', [`mc missions show ${result.key}`, `mc missions submit ${result.key}`]));
    });

  missions
    .command('unnominate')
    .description('remove a nomination from a draft')
    .argument('<key>')
    .argument('<handle>')
    .action(async (key: string, handle: string, _options: unknown, command: Command) => {
      const result = await api(command).delete<{ key: string; removed: string }>(path(key, `/nominations/${encodeURIComponent(handle)}`));
      await render(result, () => {
        success(`Removed ${result.removed} from ${result.key}.`);
        next(`mc missions match ${result.key}`);
      });
    });

  missions
    .command('submit')
    .description('send the plan and nominated crew to a director for approval')
    .argument('<key>')
    .action(async (key: string, _options: unknown, command: Command) => {
      const mission = await api(command).post<MissionView>(path(key, '/submit'));
      await render(mission, () => {
        out();
        success(`${mission.key} submitted for approval ${c.dim(`(round ${mission.review?.round ?? 1})`)}.`);
        note('A director will see it in their inbox. Nominees are not told until it is approved.');
      });
    });

  missions
    .command('approve')
    .description('approve a submitted mission — offers go to the nominated crew (directors)')
    .argument('<key>')
    .option('-n, --note <text>', 'note for the mission lead')
    .action(async (key: string, options: { note?: string }, command: Command) => {
      const result = await api(command).post<MissionView & { offersSent: number }>(path(key, '/approve'), options.note ? { note: options.note } : {});
      await render(result, () => {
        out();
        success(`${result.key} approved. ${plural(result.offersSent, 'offer')} sent.`);
        const deadline = result.roles?.flatMap((role) => role.seats).find((seat) => seat.expiresAt)?.expiresAt;
        if (deadline) note(`Crew have until ${shortDate(deadline)} (${relative(deadline)}) to respond.`);
      });
    });

  missions
    .command('reject')
    .description('send a submitted mission back to its lead for changes (directors)')
    .argument('<key>')
    .requiredOption('-n, --note <text>', 'what needs to change')
    .action(async (key: string, options: { note: string }, command: Command) => {
      const mission = await api(command).post<MissionView>(path(key, '/reject'), { note: options.note });
      await render(mission, () => {
        out();
        success(`${mission.key} sent back to ${mission.owner.name} for changes.`);
        note('They can edit it and resubmit; the review history is kept.');
      });
    });

  missions
    .command('cancel')
    .description('scrap a mission — withdraws offers and releases accepted crew (directors)')
    .argument('<key>')
    .requiredOption('--reason <text>', 'shown to affected crew')
    .option('-y, --yes', 'skip the confirmation prompt')
    .action(async (key: string, options: { reason: string; yes?: boolean }, command: Command) => {
      const client = api(command);
      const mission = await client.get<MissionView>(path(key));
      const affected = mission.staffing ? mission.staffing.accepted + mission.staffing.offered : 0;
      await confirm(
        `Cancel ${mission.key} ${mission.title}?${affected ? ` ${plural(affected, 'crew member')} will be released and told why.` : ''}`,
        options.yes,
      );
      const result = await client.post<MissionView & { released: number; withdrawn: number }>(path(key, '/cancel'), { reason: options.reason });
      await render(result, () => {
        out();
        success(`${result.key} cancelled. ${result.released} released ${sym.dot} ${result.withdrawn} offers withdrawn.`);
      });
    });

  missions
    .command('offer')
    .description('after approval: offer open seats directly (backfill — no re-approval)')
    .argument('<key>')
    .option('--recommended', "offer every open seat to the matcher's recommendation")
    .option('--role <name>', 'role to fill (with --crew)')
    .option('--crew <handle>', 'crew member to offer (with --role)')
    .action(async (key: string, options: { recommended?: boolean; role?: string; crew?: string }, command: Command) => {
      const result = await api(command).post<StaffingResult>(path(key, '/offers'), seatBody(options));
      await render(result, () => renderStaffing(result, 'Offered', [`mc missions show ${result.key}`]));
    });

  missions
    .command('retract')
    .description('withdraw an open offer (e.g. the person is no longer available)')
    .argument('<key>')
    .argument('<handle>')
    .action(async (key: string, handle: string, _options: unknown, command: Command) => {
      const result = await api(command).post<{ key: string; retracted: string }>(path(key, `/offers/${encodeURIComponent(handle)}/retract`));
      await render(result, () => {
        success(`Offer to ${result.retracted} on ${result.key} withdrawn.`);
        next(`mc missions match ${result.key}`, `mc missions offer ${result.key} --recommended`);
      });
    });

  missions
    .command('activate')
    .description('lock the crew once every seat is accepted; the roster is revealed to them')
    .argument('<key>')
    .action(async (key: string, _options: unknown, command: Command) => {
      const mission = await api(command).post<MissionView>(path(key, '/activate'));
      await render(mission, () => {
        out();
        success(`${mission.key} is ${badge('ACTIVE')}. The crew is locked and can now see who they fly with.`);
      });
    });

  missions
    .command('complete')
    .description('close out an active mission')
    .argument('<key>')
    .action(async (key: string, _options: unknown, command: Command) => {
      const mission = await api(command).post<MissionView>(path(key, '/complete'));
      await render(mission, () => success(`${mission.key} ${mission.title} is ${badge('COMPLETED')}.`));
    });

  missions
    .command('history')
    .description('the audit trail: every decision and offer, who and when')
    .argument('<key>')
    .action(async (key: string, _options: unknown, command: Command) => {
      const history = await api(command).get<{ key: string; title: string; events: EventRow[] }>(path(key, '/events'));
      await render(history, () => {
        heading(`${history.key}  ${history.title}`, 'history');
        table(
          [
            { header: 'WHEN', value: (event: EventRow) => c.dim(event.at.slice(0, 16).replace('T', ' ')) },
            { header: 'WHO', value: (event) => event.actor?.name ?? c.dim('system') },
            { header: 'STATE', value: (event) => (event.to ? badge(event.to) : '') },
            { header: 'WHAT', value: (event) => describeEvent(event) },
          ],
          history.events,
        );
      });
    });
}

function seatBody(options: { recommended?: boolean; role?: string; crew?: string; reset?: boolean }) {
  if (options.recommended) return { recommended: true, ...(options.reset ? { reset: true } : {}) };
  if (options.role && options.crew) return { role: options.role, crew: options.crew, ...(options.reset ? { reset: true } : {}) };
  throw new CliError('Pass --recommended, or --role <name> --crew <handle>.', 2);
}

// ── Rendering ────────────────────────────────────────────────────────────────

function staffingCell(mission: MissionSummary): string {
  const { seats, accepted, offered, proposed } = mission.staffing;
  if (seats === 0) return c.dim('no roles');
  if (['DRAFT', 'SUBMITTED', 'REJECTED'].includes(mission.status)) return `${proposed}/${seats} nominated`;
  return `${accepted}/${seats} accepted${offered ? c.dim(` · ${offered} pending`) : ''}`;
}

function renderList(list: MissionSummary[]): void {
  if (list.length === 0) {
    out();
    note('No missions to show.');
    return;
  }
  const crewView = list[0]!.myRole !== undefined || list.every((mission) => mission.myStatus !== undefined);
  heading('Missions', plural(list.length, 'mission'));
  table(
    [
      { header: 'KEY', value: (mission: MissionSummary) => c.bold(mission.key) },
      { header: 'TITLE', value: (mission) => mission.title, max: 32 },
      { header: 'STATUS', value: (mission) => badge(mission.status) },
      { header: 'WINDOW', value: (mission) => window(mission) },
      crewView
        ? { header: 'YOUR SEAT', value: (mission) => `${mission.myRole ?? ''} ${mission.myStatus ? badge(mission.myStatus) : ''}` }
        : { header: 'CREW', value: (mission) => staffingCell(mission) },
      ...(crewView ? [] : [{ header: 'OWNER', value: (mission: MissionSummary) => mission.owner.name }]),
    ],
    list,
  );
  next('mc missions show <key>');
}

function seatBars(seat: SeatView): string {
  const breakdown = seat.breakdown as Partial<ScoreBreakdown> | null;
  return breakdown?.components ? `${components(breakdown as ScoreBreakdown)}  ` : '';
}

function seatNote(seat: SeatView): string {
  if (seat.blocked) return c.yellow(`${sym.warn} ${seat.blocked}`);
  if (seat.status === 'OFFERED' && seat.expiresAt) return c.dim(`respond by ${shortDate(seat.expiresAt)} (${relative(seat.expiresAt)})`);
  if (seat.reason) return c.dim(seat.reason);
  return '';
}

export function renderMission(mission: MissionView): void {
  out();
  out(`  ${c.bold(mission.key)}  ${c.bold(mission.title)}  ${badge(mission.status)}`);
  if (mission.description) out(`  ${c.dim(mission.description)}`);
  out(`  ${window(mission)} ${c.dim(`${sym.dot} owner ${mission.owner.name}`)}`);
  if (mission.cancelReason) warning(`Cancelled: ${mission.cancelReason}`);

  if (mission.viewer === 'crew') {
    renderCrewMission(mission);
    return;
  }

  const staffing = mission.staffing!;
  out();
  if (['DRAFT', 'REJECTED', 'SUBMITTED'].includes(mission.status)) {
    out(`  ${c.dim('Crew')}   ${staffing.proposed}/${staffing.seats} seats nominated ${c.dim('(nominees are not told until approval)')}`);
  } else {
    out(`  ${c.dim('Crew')}   ${staffing.accepted}/${staffing.seats} accepted ${c.dim(`${sym.dot} ${staffing.offered} awaiting reply ${sym.dot} ${staffing.open} open`)}`);
  }

  const roles = mission.roles ?? [];
  if (roles.some((role) => role.seats.some((seat) => seatBars(seat)))) {
    out(`  ${c.dim('       score bars: skill · workload · experience · commitment')}`);
  }
  if (roles.length === 0) {
    out();
    note('No roles yet.');
  }
  const nameWidth = Math.max(12, ...roles.flatMap((role) => [...role.seats, ...role.closed].map((seat) => visibleLength(seat.name))));
  for (const role of roles) {
    out();
    out(`  ${c.bold(role.name)} ${c.dim(`×${role.headcount}`)}   ${c.dim(role.skills.map((skill) => `${skill.name} ≥${skill.min}`).join(' · '))}`);
    for (const seat of role.seats) {
      out(`    ${seat.name.padEnd(nameWidth)}  ${badge(seat.status).padEnd(8 + (badge(seat.status).length - seat.status.length))}  ${score(seat.score).padStart(5)}  ${seatBars(seat)}${seatNote(seat)}`);
    }
    for (let index = 0; index < role.open; index += 1) out(`    ${c.dim(`${sym.open} open seat`)}`);
    for (const seat of role.closed) {
      out(`    ${c.dim(seat.name.padEnd(nameWidth))}  ${badge(seat.status)}  ${c.dim(seat.reason ?? '')}`);
    }
  }

  if (mission.review) {
    const review = mission.review;
    out();
    out(
      `  ${c.dim('Review')} round ${review.round} ${c.dim(sym.dot)} submitted by ${review.submittedBy.name} ${c.dim(relative(review.submittedAt))} ${c.dim(sym.dot)} ${badge(review.decision)}${review.decidedBy ? ` by ${review.decidedBy.name}` : ''}`,
    );
    if (review.note) out(`         ${c.italic(`"${review.note}"`)}`);
  }

  const actions = mission.allowedActions ?? [];
  out();
  if (actions.length === 0) {
    note('You have no actions on this mission.');
  } else {
    out(`  ${c.dim('You can')}`);
    for (const action of actions) {
      const blocked = action.blockers.length > 0;
      out(`    ${blocked ? c.yellow(sym.fail) : c.green(sym.ok)} ${action.action.padEnd(9)} ${blocked ? c.yellow(action.blockers.join('; ')) : c.dim(action.summary)}`);
    }
  }
  next(...leadNext(mission));
}

function leadNext(mission: MissionView): string[] {
  const key = mission.key;
  const action = (name: string) => mission.allowedActions?.find((entry) => entry.action === name);
  const blockedSeat = mission.roles?.flatMap((role) => role.seats).find((seat) => seat.blocked);
  if (blockedSeat) return [`mc missions retract ${key} ${blockedSeat.handle}`];
  const submit = action('submit');
  if (submit) return submit.blockers.length === 0 ? [`mc missions submit ${key}`] : [`mc missions match ${key}`, `mc missions nominate ${key} --recommended`];
  if (action('approve')) return [`mc missions approve ${key} --note "…"`, `mc missions reject ${key} --note "what to change"`];
  const activate = action('activate');
  if (activate && activate.blockers.length === 0) return [`mc missions activate ${key}`];
  if (action('offer') && (mission.staffing?.open ?? 0) > 0) return [`mc missions match ${key}`, `mc missions offer ${key} --recommended`];
  if (action('complete')) return [`mc missions complete ${key}`];
  return [];
}

function renderCrewMission(mission: MissionView): void {
  const seat = mission.assignment!;
  out();
  const deadline = seat.status === 'OFFERED' && seat.expiresAt ? c.dim(` ${sym.dot} respond by ${shortDate(seat.expiresAt)} (${relative(seat.expiresAt)})`) : '';
  out(`  ${c.dim('Your seat')}  ${seat.kind === 'BACKUP' ? `backup for ${seat.role}` : seat.role} ${c.dim(sym.dot)} ${badge(seat.status)}${deadline}`);
  if (seat.blocked) warning(seat.blocked);
  if (seat.reason && seat.status !== 'OFFERED') note(seat.reason);
  out();
  if (mission.roster) {
    out(`  ${c.dim('Crew')}`);
    for (const member of mission.roster) out(`    ${member.name.padEnd(20)} ${c.dim(member.role)}`);
  } else {
    out(`  ${c.dim('Crew')}       ${c.dim(mission.rosterNote ?? '')}`);
  }
  if (seat.status === 'OFFERED') next(`mc offers accept ${mission.key}`, `mc offers decline ${mission.key} --reason "…"`);
}

function components(breakdown: ScoreBreakdown): string {
  const parts = breakdown.components;
  return `${bar(parts.skill)} ${bar(parts.workload)} ${bar(parts.experience)} ${bar(parts.commitment)}`;
}

function renderMatch(response: MatchResponse, all: boolean): void {
  const { mission, result } = response;
  heading(`Match ${sym.dot} ${mission.key} ${mission.title}`, `${window(mission)} ${sym.dot} ${plural(result.openSeats, 'open seat')}`);

  if (result.openSeats === 0) {
    note('Every seat is already taken (nominated, offered or accepted).');
    return;
  }

  out(`  ${c.bold('Recommended crew')}  ${result.complete ? c.green(`${sym.ok} every open seat filled`) : c.yellow(`${sym.warn} ${plural(result.unfilled.reduce((acc, entry) => acc + entry.seats, 0), 'seat')} cannot be filled`)}`);
  out();
  const roleWidth = Math.max(4, ...result.recommendations.map((rec) => rec.roleName.length), ...result.unfilled.map((entry) => entry.roleName.length));
  const nameWidth = Math.max(4, ...result.recommendations.map((rec) => rec.name.length));
  if (result.recommendations.length > 0) {
    out(`    ${c.dim('ROLE'.padEnd(roleWidth))}  ${c.dim('CREW'.padEnd(nameWidth))}  ${c.dim('SCORE')}  ${c.dim('SKILL LOAD  EXP   COMMIT')}`);
  }
  for (const rec of result.recommendations) {
    const rarity = rec.breakdown.rarityPenalty > 0 ? c.dim(` (−${rec.breakdown.rarityPenalty} rarity)`) : '';
    out(`    ${rec.roleName.padEnd(roleWidth)}  ${rec.name.padEnd(nameWidth)}  ${score(rec.breakdown.total).padStart(5)}  ${components(rec.breakdown)}${rarity}`);
    for (const line of rec.notes) {
      const flag = line.startsWith('pending') || line.startsWith('nominated');
      out(`    ${' '.repeat(roleWidth)}  ${flag ? c.yellow(`${sym.warn} ${line}`) : c.dim(`↳ ${line}`)}`);
    }
  }
  for (const gap of result.unfilled) {
    out(`    ${gap.roleName.padEnd(roleWidth)}  ${c.yellow(`${sym.open} ${plural(gap.seats, 'seat')} unfilled — ${gap.reason}`)}`);
  }
  out();
  note(`score = 45% skill + 25% workload (±90 days) + 20% experience + 10% commitment · rare skills not needed cost up to 5 points`);

  for (const role of result.roles) {
    if (role.open === 0) {
      out();
      out(`  ${c.dim(`${role.roleName} ${sym.dot} ${role.filled}/${role.headcount} taken ${sym.dot} nothing to match`)}`);
      continue;
    }
    out();
    out(`  ${c.bold(role.roleName)} ${c.dim(`${sym.dot} ${role.filled}/${role.headcount} taken ${sym.dot} ${role.open} open`)}`);
    const shown = all ? role.ranked : role.ranked.slice(0, 5);
    if (shown.length > 0) {
      table(
        [
          { header: '#', value: (candidate: RankedCandidate) => String(role.ranked.indexOf(candidate) + 1), align: 'right' },
          { header: 'CREW', value: (candidate) => candidate.name },
          { header: 'SCORE', value: (candidate) => score(candidate.breakdown.total), align: 'right' },
          { header: 'ADJ', value: (candidate) => (candidate.breakdown.rarityPenalty ? c.dim(candidate.breakdown.effective.toFixed(1)) : ''), align: 'right' },
          { header: 'SKILL LOAD  EXP   COMMIT', value: (candidate) => components(candidate.breakdown) },
          {
            header: '',
            value: (candidate) =>
              [
                candidate.seatedAs === role.roleName ? c.green(`${sym.star} recommended`) : candidate.seatedAs ? c.dim(`seated as ${candidate.seatedAs}`) : '',
                ...candidate.flags.map((flag) => c.yellow(`${sym.warn} ${flag}`)),
              ]
                .filter(Boolean)
                .join('  '),
          },
        ],
        shown,
        4,
      );
      if (!all && role.ranked.length > shown.length) note(`  …and ${role.ranked.length - shown.length} more (--all)`);
    } else {
      out(`    ${c.yellow('No eligible crew.')}`);
    }
    const filters = [
      role.funnel.skill && `${role.funnel.skill} lack skills`,
      role.funnel.unavailable && `${role.funnel.unavailable} unavailable`,
      role.funnel.conflict && `${role.funnel.conflict} committed elsewhere`,
      role.funnel.restGap && `${role.funnel.restGap} inside the ${response.restGapDays}-day rest gap`,
      role.funnel.onMission && `${role.funnel.onMission} already on / out of this mission`,
    ].filter(Boolean);
    if (filters.length) out(`    ${c.dim(`Filtered out of ${role.funnel.considered}: ${filters.join(' · ')}`)}`);
    for (const miss of role.nearMisses) out(`    ${c.dim('Near miss:')} ${miss.name} ${c.dim(`— ${miss.detail}`)}`);
  }

  const draft = ['DRAFT', 'REJECTED'].includes(mission.status);
  const nearMiss = result.roles.flatMap((role) => role.nearMisses)[0];
  next(
    result.recommendations.length === 0
      ? ''
      : draft
        ? `mc missions nominate ${mission.key} --recommended`
        : `mc missions offer ${mission.key} --recommended`,
    `mc missions match ${mission.key} --explain ${nearMiss?.handle ?? '<handle>'}     ${c.dim('why (not) someone')}`,
  );
  if (result.recommendations.length === 0 && !draft) {
    note('  No one can fill this seat right now. Options: wait for availability to change, or have a director cancel and re-plan.');
  }
}

function renderExplanation(response: MatchResponse): void {
  const why = response.explanation!;
  heading(`Why ${why.name}?`, `${response.mission.key} ${response.mission.title}`);
  if (why.seatedAs) out(`  ${c.green(`${sym.star} Recommended as ${why.seatedAs}`)}`);
  else out(`  ${c.dim('Not in the recommended crew.')}`);
  for (const flag of why.flags) warning(flag);
  for (const role of why.roles) {
    out();
    if (!role.eligible) {
      out(`  ${c.bold(role.roleName)}  ${c.red(`${sym.fail} not eligible`)}`);
      for (const rejection of role.rejections) out(`    ${c.dim(sym.bullet)} ${rejection.detail}`);
      continue;
    }
    const breakdown = role.breakdown!;
    const facts = breakdown.facts;
    out(
      `  ${c.bold(role.roleName)}  ${c.green(`${sym.ok} eligible`)} ${c.dim(sym.dot)} rank ${role.rank} of ${role.of} ${c.dim(sym.dot)} ${score(breakdown.total)}${breakdown.rarityPenalty ? c.dim(` → ${breakdown.effective} after rarity`) : ''}${role.seatedHere ? `  ${c.green(`${sym.star} seated here`)}` : ''}`,
    );
    out(`    ${bar(breakdown.components.skill)} skill       ${facts.skills.map((skill) => `${skill.name} ${skill.level} ${c.dim(`(needs ${skill.min})`)}`).join(', ')}`);
    out(`    ${bar(breakdown.components.workload)} workload    ${facts.committedDays} of ${facts.horizonDays} days committed around the mission`);
    out(`    ${bar(breakdown.components.experience)} experience  ${plural(facts.relevantMissions, 'relevant completed mission')}`);
    out(`    ${bar(breakdown.components.commitment)} commitment  ${facts.accepts} accepted, ${facts.dropouts} dropped out`);
    if (facts.rareSkills.length) {
      out(`    ${c.dim(`rarity −${breakdown.rarityPenalty}: holds ${facts.rareSkills.map((entry) => `${entry.name} (${entry.holders === 1 ? 'only holder' : `1 of ${entry.holders} at level 4+`})`).join(', ')}, not needed for this role`)}`);
    }
  }
}

function renderStaffing(result: StaffingResult, verb: string, hints: string[]): void {
  out();
  if (result.created.length === 0) {
    warning('Nobody was added.');
  } else {
    success(`${verb} ${plural(result.created.length, 'crew member')} on ${result.key}:`);
    for (const seat of result.created) {
      out(`    ${seat.role.padEnd(20)} ${seat.name.padEnd(18)} ${score(seat.score)}${seat.expiresAt ? c.dim(`  respond by ${shortDate(seat.expiresAt)}`) : ''}`);
    }
  }
  for (const gap of result.unfilled) warning(`${gap.roleName}: ${plural(gap.seats, 'seat')} unfilled — ${gap.reason}`);
  if (verb === 'Nominated') note('Nominees are not notified until a director approves the mission.');
  next(...hints);
}

interface EventRow {
  at: string;
  type: string;
  actor: { handle: string; name: string } | null;
  from: string | null;
  to: string | null;
  payload: Record<string, any>;
}

function describeEvent(event: EventRow): string {
  const p = event.payload ?? {};
  const seats = (list: Array<{ role: string; crew: string; score?: number }> | undefined) =>
    (list ?? []).map((seat) => `${seat.crew} as ${seat.role}${seat.score ? c.dim(` (${seat.score.toFixed(1)})`) : ''}`).join(', ');
  switch (event.type) {
    case 'MISSION_CREATED':
      return 'created the mission';
    case 'MISSION_UPDATED':
      return `edited ${(p.fields ?? []).join(', ')}`;
    case 'ROLES_UPDATED':
      return `set roles: ${(p.roles ?? []).join(', ')}${p.clearedNominations ? c.dim(` (cleared ${p.clearedNominations} nominations)`) : ''}`;
    case 'CREW_NOMINATED':
      return `nominated ${seats(p.seats)}`;
    case 'NOMINATION_REMOVED':
      return p.crew ? `removed the nomination for ${p.crew}` : `cleared ${p.cleared} nominations`;
    case 'MISSION_SUBMITTED':
      return `submitted for approval${p.round ? c.dim(` (round ${p.round})`) : ''}`;
    case 'MISSION_APPROVED':
      return `approved${p.note ? ` — "${p.note}"` : ''}`;
    case 'MISSION_REJECTED':
      return `requested changes — "${p.note ?? ''}"`;
    case 'MISSION_CANCELLED':
      return `cancelled — "${p.reason ?? ''}"${p.released !== undefined ? c.dim(` (${p.released} released, ${p.withdrawn} withdrawn)`) : ''}`;
    case 'OFFERS_SENT':
      return `offers sent to ${(p.crew ?? []).join(', ') || 'nominees'}`;
    case 'OFFER_SENT':
      return `offered ${seats(p.seats)}`;
    case 'OFFER_RETRACTED':
      return `withdrew the offer to ${p.crew}`;
    case 'OFFER_ACCEPTED':
      return `accepted ${p.role ?? 'their seat'}`;
    case 'OFFER_DECLINED':
      return `declined ${p.role ?? 'their offer'}${p.reason ? ` — "${p.reason}"` : ''}`;
    case 'OFFER_EXPIRED':
      return `${p.crew}'s offer for ${p.role} expired`;
    case 'CREW_DROPPED_OUT':
      return `dropped out of ${p.role} — "${p.reason ?? ''}"`;
    case 'MISSION_ACTIVATED':
      return 'activated — crew locked';
    case 'MISSION_COMPLETED':
      return 'completed';
    default:
      return event.type;
  }
}
