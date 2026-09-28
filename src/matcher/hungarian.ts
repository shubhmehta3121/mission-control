/**
 * Maximum-weight assignment (Hungarian / Kuhn–Munkres with potentials, O(n²·m)).
 *
 * weights[row][col] is the value of giving `row` (a seat) to `col` (a person);
 * null means "not allowed". Returns, for each row, the chosen column or -1.
 *
 * This solves "maximise total value", nothing more. The matcher encodes its
 * priorities (fill the most seats first, then best quality) into the weights.
 * Allowed weights must be non-negative integers; disallowed pairs are treated
 * as value 0 and reported back as -1, so they never count as a fill.
 *
 * Deterministic: for equal-value optima, the lowest column index wins.
 */
export function maxWeightAssignment(weights: ReadonlyArray<ReadonlyArray<number | null>>): number[] {
  const rows = weights.length;
  if (rows === 0) return [];
  const cols = Math.max(...weights.map((row) => row.length), 0);
  if (cols === 0) return new Array<number>(rows).fill(-1);

  // The core routine needs rows ≤ cols: pad with zero-value dummy columns.
  const width = Math.max(cols, rows);
  let maxWeight = 0;
  for (const row of weights) {
    for (const value of row) {
      if (value !== null && value !== undefined) {
        if (!Number.isInteger(value) || value < 0) {
          throw new Error(`maxWeightAssignment expects non-negative integer weights, got ${value}`);
        }
        if (value > maxWeight) maxWeight = value;
      }
    }
  }
  const cost = (row: number, col: number): number => {
    const value = col < cols ? (weights[row]?.[col] ?? null) : null;
    return maxWeight - (value ?? 0);
  };

  // 1-indexed arrays as in the textbook formulation; index 0 is a sentinel.
  const u = new Array<number>(rows + 1).fill(0);
  const v = new Array<number>(width + 1).fill(0);
  const matchedRow = new Array<number>(width + 1).fill(0); // matchedRow[col] = row assigned to col
  const way = new Array<number>(width + 1).fill(0);

  for (let row = 1; row <= rows; row += 1) {
    matchedRow[0] = row;
    let col0 = 0;
    const minv = new Array<number>(width + 1).fill(Number.POSITIVE_INFINITY);
    const used = new Array<boolean>(width + 1).fill(false);
    do {
      used[col0] = true;
      const row0 = matchedRow[col0]!;
      let delta = Number.POSITIVE_INFINITY;
      let col1 = 0;
      for (let col = 1; col <= width; col += 1) {
        if (used[col]) continue;
        const reduced = cost(row0 - 1, col - 1) - u[row0]! - v[col]!;
        if (reduced < minv[col]!) {
          minv[col] = reduced;
          way[col] = col0;
        }
        if (minv[col]! < delta) {
          delta = minv[col]!;
          col1 = col;
        }
      }
      for (let col = 0; col <= width; col += 1) {
        if (used[col]) {
          u[matchedRow[col]!]! += delta;
          v[col]! -= delta;
        } else {
          minv[col]! -= delta;
        }
      }
      col0 = col1;
    } while (matchedRow[col0] !== 0);
    do {
      const col1 = way[col0]!;
      matchedRow[col0] = matchedRow[col1]!;
      col0 = col1;
    } while (col0 !== 0);
  }

  const result = new Array<number>(rows).fill(-1);
  for (let col = 1; col <= width; col += 1) {
    const row = matchedRow[col]!;
    if (row === 0 || col > cols) continue;
    const value = weights[row - 1]?.[col - 1] ?? null;
    if (value !== null) result[row - 1] = col - 1;
  }
  return result;
}
