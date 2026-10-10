// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Program } from "@untzel/core";

// Same program after analyze; formatting may differ. Formatting shows up in a Program in
// three places, and
// only there: source ranges and the source hash, the split of hits words ("x... x..."
// is two words, "x...x..." one, same steps), and the order of track lines (no edit moves
// a line, and the demo adds tracks in producer order). Everything else is compared.

/** Source ranges and the three hashes of the text: the source, the light's seed, the stage plan's seed. */
const FORMATTING_KEYS = new Set(["source", "sourceHash", "lightSourceHash", "stagePlanHash"]);

interface HitsElement {
  readonly kind: "hits";
  readonly steps: readonly string[];
  readonly probability: null;
  readonly repeat: 1;
}

function isPlainHits(value: unknown): value is HitsElement {
  if (typeof value !== "object" || value === null) return false;
  const element = value as Partial<HitsElement>;
  return element.kind === "hits" && element.probability === null && element.repeat === 1;
}

/** Adjacent hits words with no suffix are one run of steps. */
function mergeHits(elements: readonly unknown[]): unknown[] {
  const merged: unknown[] = [];
  for (const element of elements) {
    const previous = merged.at(-1);
    if (isPlainHits(previous) && isPlainHits(element)) {
      merged[merged.length - 1] = { ...previous, steps: [...previous.steps, ...element.steps] };
    } else {
      merged.push(element);
    }
  }
  return merged;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value !== "object" || value === null) return value;
  const entries = Object.entries(value)
    .filter(([key]) => !FORMATTING_KEYS.has(key))
    .map(([key, child]): [string, unknown] => {
      const normalized = normalize(child);
      return [key, key === "elements" && Array.isArray(normalized) ? mergeHits(normalized) : normalized];
    });
  return Object.fromEntries(entries);
}

/** The program without its formatting, tracks by name. */
export function comparableProgram(program: Program): unknown {
  const tracks = [...program.tracks].sort((a, b) => a.name.localeCompare(b.name));
  return normalize({ ...program, tracks });
}

/** JSON that keeps bigints (rationals), for comparing plain data. */
export function serialize(value: unknown): string {
  return JSON.stringify(value, (_, child: unknown) => (typeof child === "bigint" ? `${child}n` : child));
}

export function isSameProgram(a: Program, b: Program): boolean {
  return serialize(comparableProgram(a)) === serialize(comparableProgram(b));
}
