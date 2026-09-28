import { createInterface } from 'node:readline/promises';
import type { Command } from 'commander';
import { client, type Client } from '../client.js';
import { CliError } from '../config.js';
import { isJson, json } from '../ui.js';

export interface GlobalOptions {
  json?: boolean;
  profile?: string;
  color?: boolean;
}

export function globals(command: Command): GlobalOptions {
  return command.optsWithGlobals<GlobalOptions>();
}

export function api(command: Command): Client {
  return client(globals(command).profile);
}

/** Run a command action; in --json mode print the raw API payload instead of the human rendering. */
export async function render<T>(payload: T, human: (value: T) => void): Promise<void> {
  if (isJson()) json(payload);
  else human(payload);
}

export async function confirm(question: string, assumeYes?: boolean): Promise<void> {
  if (assumeYes) return;
  if (!process.stdin.isTTY) throw new CliError('This needs confirmation. Re-run with --yes.', 2);
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`  ${question} [y/N] `);
    if (!/^y(es)?$/i.test(answer.trim())) throw new CliError('Stopped — nothing was changed.', 1);
  } finally {
    prompt.close();
  }
}

export function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function positiveInt(label: string) {
  return (value: string): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) throw new CliError(`${label} must be a whole number, got "${value}".`, 2);
    return parsed;
  };
}

/**
 * "Pilot:1:nav=4,eva=2" or "Pilot:nav=4" (headcount 1).
 * Skill keys come from `mc skills list`.
 */
export function parseRoleSpec(spec: string): { name: string; headcount: number; skills: Array<{ skill: string; min: number }> } {
  const parts = spec.split(':').map((part) => part.trim());
  const usage = `Role "${spec}" should look like "Pilot:1:nav=4,eva=2" (name:headcount:skill=min,…).`;
  if (parts.length < 2 || parts.length > 3) throw new CliError(usage, 2);
  const [name, maybeCount, maybeSkills] = parts as [string, string, string | undefined];
  const headcount = maybeSkills === undefined ? 1 : Number(maybeCount);
  const skillText = maybeSkills ?? maybeCount;
  if (!name || !Number.isInteger(headcount) || headcount < 1) throw new CliError(usage, 2);
  const skills = skillText.split(',').map((entry) => {
    const [skill, min] = entry.split('=').map((piece) => piece.trim());
    const level = Number(min);
    if (!skill || !Number.isInteger(level)) throw new CliError(usage, 2);
    return { skill, min: level };
  });
  return { name, headcount, skills };
}

/** "nav=5" → { skill: "nav", level: 5 } */
export function parseSkillLevel(entry: string): { skill: string; level: number } {
  const [skill, level] = entry.split('=').map((piece) => piece.trim());
  const parsed = Number(level);
  if (!skill || !Number.isInteger(parsed)) throw new CliError(`"${entry}" should look like nav=4 (skill=level, 1–5).`, 2);
  return { skill, level: parsed };
}
