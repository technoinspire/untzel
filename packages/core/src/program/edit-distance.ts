// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

/**
 * How far the library search reaches. The language's "Did you mean" scales with the word
 * instead (suggestionReach in @untzel/language).
 */
export const MAX_SUGGESTION_DISTANCE = 2;

/** Damerau-Levenshtein distance (optimal string alignment) over UTF-16 code units. */
export function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const columns = b.length + 1;
  const table: number[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => (row === 0 ? column : column === 0 ? row : 0)),
  );
  const cell = (row: number, column: number): number => table[row]?.[column] ?? 0;
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = a[row - 1] === b[column - 1] ? 0 : 1;
      let best = Math.min(cell(row - 1, column) + 1, cell(row, column - 1) + 1, cell(row - 1, column - 1) + cost);
      const transposed = row > 1 && column > 1 && a[row - 1] === b[column - 2] && a[row - 2] === b[column - 1];
      if (transposed) best = Math.min(best, cell(row - 2, column - 2) + 1);
      (table[row] as number[])[column] = best;
    }
  }
  return cell(a.length, b.length);
}
