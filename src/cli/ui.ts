/**
 * Terminal presentation: colour (respects NO_COLOR / non-TTY), status badges,
 * aligned tables, score bars, relative dates and "Next:" hints. No business
 * logic lives in the CLI — it only renders what the API returns.
 */

const state = { color: Boolean(process.stdout.isTTY) && !process.env.NO_COLOR, json: false };
if (process.env.FORCE_COLOR && process.env.FORCE_COLOR !== '0') state.color = true;

export function configureOutput(options: { color?: boolean; json?: boolean }): void {
  if (options.color === false) state.color = false;
  if (options.json) state.json = true;
}

export function isJson(): boolean {
  return state.json;
}

const wrap = (open: number, close: number) => (text: string | number) =>
  state.color ? `\u001b[${open}m${text}\u001b[${close}m` : String(text);

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  italic: wrap(3, 23),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
};

export const sym = { ok: '✓', fail: '✗', warn: '!', arrow: '→', dot: '·', bullet: '•', star: '★', open: '○', filled: '●' };

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;]*m/g;
export function visibleLength(text: string): number {
  return [...text.replace(ANSI, '')].length;
}

function pad(text: string, width: number, align: 'left' | 'right' = 'left'): string {
  const gap = Math.max(0, width - visibleLength(text));
  return align === 'right' ? ' '.repeat(gap) + text : text + ' '.repeat(gap);
}

export function out(line = ''): void {
  process.stdout.write(`${line}\n`);
}

export function json(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function heading(title: string, meta?: string): void {
  out();
  out(`  ${c.bold(title)}${meta ? `  ${c.dim(meta)}` : ''}`);
  out();
}

export function success(message: string): void {
  out(`  ${c.green(sym.ok)} ${message}`);
}

export function warning(message: string): void {
  out(`  ${c.yellow(sym.warn)} ${c.yellow(message)}`);
}

export function note(message: string): void {
  out(`  ${c.dim(message)}`);
}

export function next(...commands: string[]): void {
  const shown = commands.filter(Boolean);
  if (shown.length === 0) return;
  out();
  shown.forEach((command, index) => out(`  ${index === 0 ? c.dim('Next:') : '     '} ${c.cyan(command)}`));
}

export interface Column<Row> {
  header: string;
  value: (row: Row) => string;
  align?: 'left' | 'right';
  max?: number;
}

function truncate(text: string, max?: number): string {
  if (!max || visibleLength(text) <= max) return text;
  const plain = text.replace(ANSI, '');
  return `${[...plain].slice(0, max - 1).join('')}…`;
}

export function table<Row>(columns: Column<Row>[], rows: Row[], indent = 2): void {
  const cells = rows.map((row) => columns.map((column) => truncate(column.value(row), column.max)));
  const widths = columns.map((column, index) =>
    Math.max(visibleLength(column.header), ...cells.map((line) => visibleLength(line[index] ?? ''))),
  );
  const prefix = ' '.repeat(indent);
  out(prefix + columns.map((column, index) => c.dim(pad(column.header, widths[index]!, column.align))).join('  ').trimEnd());
  for (const line of cells) {
    out(prefix + line.map((cell, index) => pad(cell, widths[index]!, columns[index]!.align)).join('  ').trimEnd());
  }
}

const MISSION_COLORS: Record<string, (text: string) => string> = {
  DRAFT: c.gray,
  SUBMITTED: c.blue,
  REJECTED: c.red,
  APPROVED: c.green,
  ACTIVE: c.magenta,
  COMPLETED: c.cyan,
  CANCELLED: c.yellow,
  PROPOSED: c.gray,
  OFFERED: c.blue,
  ACCEPTED: c.green,
  DECLINED: c.red,
  EXPIRED: c.yellow,
  WITHDRAWN: c.gray,
  RELEASED: c.gray,
  DROPPED: c.red,
  PENDING: c.blue,
};

export function badge(status: string): string {
  return (MISSION_COLORS[status] ?? ((text: string) => text))(status);
}

export function bar(value: number, width = 5): string {
  const filled = Math.max(0, Math.min(width, Math.round(value * width)));
  const text = '█'.repeat(filled) + c.dim('░'.repeat(width - filled));
  return value >= 0.8 ? c.green(text) : value >= 0.5 ? text : c.yellow(text);
}

export function score(value: number): string {
  const text = value.toFixed(1);
  return value >= 80 ? c.green(text) : value >= 65 ? text : c.yellow(text);
}

export function relative(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < 60_000) return 'just now';
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const amount = minutes < 60 ? plural(minutes, 'minute') : hours < 36 ? plural(hours, 'hour') : plural(days, 'day');
  return diff >= 0 ? `in ${amount}` : `${amount} ago`;
}

export function shortDate(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '—';
}

export function window(item: { startDate: string; endDate: string; days?: number }): string {
  return `${item.startDate} ${sym.arrow} ${item.endDate}${item.days ? c.dim(` (${item.days}d)`) : ''}`;
}

export function plural(count: number, word: string, many = `${word}s`): string {
  return `${count} ${count === 1 ? word : many}`;
}
