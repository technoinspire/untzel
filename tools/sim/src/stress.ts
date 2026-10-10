// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Generated texts for scale tests: the simulator (--scale), the page (?stress=<n>) and
// the browser scale test use the same text, so their numbers compare.

export interface StressInstrument {
  readonly name: string;
  readonly defaultPattern: string;
}

/** The order of the scale test: kick, hat, bass alternating. */
export const STRESS_ORDER = ["kick", "hat", "bass"] as const;

/** `count` tracks, each instrument playing its defaultPattern at 132 BPM, no sections. */
export function stressSource(instruments: readonly StressInstrument[], count: number): string {
  const byName = new Map(instruments.map((instrument) => [instrument.name, instrument]));
  const order = STRESS_ORDER.flatMap((name) => {
    const instrument = byName.get(name);
    return instrument === undefined ? [] : [instrument];
  });
  if (order.length === 0) throw new Error("stressSource needs kick, hat or bass");
  const lines = ["tempo 132"];
  const used = new Map<string, number>();
  for (let index = 0; index < count; index += 1) {
    const instrument = order[index % order.length];
    if (instrument === undefined) break;
    const ordinal = (used.get(instrument.name) ?? 0) + 1;
    used.set(instrument.name, ordinal);
    const name = ordinal === 1 ? instrument.name : `${instrument.name}${ordinal}`;
    lines.push(`${name}: ${instrument.name} ${instrument.defaultPattern}`);
  }
  return `${lines.join("\n")}\n`;
}

export interface EngineInstrument extends StressInstrument {
  readonly engine: string;
  readonly costPerVoice: number;
  readonly voices: number;
}

/**
 * One instrument per engine for the per-engine scale lines: the one whose full voice pool
 * costs the most, so each line
 * is that engine's worst case. In engine order of first appearance.
 */
export function engineRepresentatives<T extends EngineInstrument>(instruments: readonly T[]): readonly T[] {
  const chosen = new Map<string, T>();
  for (const instrument of instruments) {
    const current = chosen.get(instrument.engine);
    const pool = (candidate: T): number => candidate.costPerVoice * candidate.voices;
    if (current === undefined || pool(instrument) > pool(current)) chosen.set(instrument.engine, instrument);
  }
  return [...chosen.values()];
}

/** Tracks per per-engine scale line: the engine's worst case, ×8. */
export const ENGINE_TRACKS = 8;

/** `count` tracks of one instrument playing its defaultPattern at 132 BPM. */
export function instrumentStressSource(instrument: StressInstrument, count: number): string {
  const lines = ["tempo 132"];
  for (let index = 1; index <= count; index += 1) {
    lines.push(`${instrument.name}${index}: ${instrument.name} ${instrument.defaultPattern}`);
  }
  return `${lines.join("\n")}\n`;
}
