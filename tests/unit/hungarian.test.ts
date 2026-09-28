import { describe, expect, it } from 'vitest';
import { maxWeightAssignment } from '../../src/matcher/hungarian.js';

type Matrix = Array<Array<number | null>>;

function total(weights: Matrix, choice: number[]): { value: number; filled: number } {
  let value = 0;
  let filled = 0;
  choice.forEach((col, row) => {
    if (col < 0) return;
    value += weights[row]![col]!;
    filled += 1;
  });
  return { value, filled };
}

/** Exhaustive optimum: every row picks a distinct column or nothing. */
function bruteForce(weights: Matrix): number {
  const rows = weights.length;
  const cols = weights[0]?.length ?? 0;
  let best = 0;
  const used = new Array<boolean>(cols).fill(false);
  const walk = (row: number, acc: number): void => {
    if (row === rows) {
      best = Math.max(best, acc);
      return;
    }
    walk(row + 1, acc);
    for (let col = 0; col < cols; col += 1) {
      const value = weights[row]![col];
      if (used[col] || value === null || value === undefined) continue;
      used[col] = true;
      walk(row + 1, acc + value);
      used[col] = false;
    }
  };
  walk(0, 0);
  return best;
}

/** Small deterministic PRNG (mulberry32) so the property test is reproducible. */
function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('maxWeightAssignment', () => {
  it('returns [] for no rows and -1s when there are no columns', () => {
    expect(maxWeightAssignment([])).toEqual([]);
    expect(maxWeightAssignment([[], []])).toEqual([-1, -1]);
  });

  it('finds the optimum where greedy row-by-row would not', () => {
    // Greedy takes row0→col0 (9) and leaves row1 with col1 (1) = 10. Optimum: 8 + 7 = 15.
    const weights: Matrix = [
      [9, 8],
      [7, 1],
    ];
    const choice = maxWeightAssignment(weights);
    expect(choice).toEqual([1, 0]);
    expect(total(weights, choice).value).toBe(15);
  });

  it('never uses a disallowed (null) pair', () => {
    const weights: Matrix = [
      [null, 5],
      [null, 9],
    ];
    const choice = maxWeightAssignment(weights);
    expect(choice.filter((col) => col === 0)).toHaveLength(0);
    expect(total(weights, choice)).toEqual({ value: 9, filled: 1 });
  });

  it('handles more rows than columns and more columns than rows', () => {
    const tall: Matrix = [[3], [5], [4]];
    expect(total(tall, maxWeightAssignment(tall)).value).toBe(5);
    const wide: Matrix = [[1, 7, 3, 2]];
    expect(maxWeightAssignment(wide)).toEqual([1]);
  });

  it('matches brute force on 300 random matrices (with disallowed pairs)', () => {
    const random = rng(42);
    for (let trial = 0; trial < 300; trial += 1) {
      const rows = 1 + Math.floor(random() * 5);
      const cols = 1 + Math.floor(random() * 6);
      const weights: Matrix = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => (random() < 0.25 ? null : Math.floor(random() * 100))),
      );
      const choice = maxWeightAssignment(weights);
      const cols_ = choice.filter((col) => col >= 0);
      expect(new Set(cols_).size).toBe(cols_.length); // each column used at most once
      expect(total(weights, choice).value).toBe(bruteForce(weights));
    }
  });

  it('is deterministic for tied optima', () => {
    const weights: Matrix = [
      [5, 5],
      [5, 5],
    ];
    expect(maxWeightAssignment(weights)).toEqual(maxWeightAssignment(weights));
  });

  it('rejects non-integer or negative weights', () => {
    expect(() => maxWeightAssignment([[1.5]])).toThrow();
    expect(() => maxWeightAssignment([[-1]])).toThrow();
  });
});
