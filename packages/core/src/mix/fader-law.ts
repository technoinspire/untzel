// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The gain fader law. The text keeps linear amplitude
// (`gain 1` = 0 dB, `gain 0.5` = −6.02 dB); only the slider is a console fader in dB:
//
//   position 0           Off (gain 0)
//   0    < p <= 0.25     −60 to −20 dB, stretched
//   0.25 <= p <= 0.75    −20 to 0 dB, linear in dB
//   0.75 <= p <= 1       0 to +6 dB (gain up to about 2)
//
// One owner and two consumers: the adapter (gain → position and label) and the session
// (position → gain). No view computes a dB value.

export const FADER_MIN_DB = -60;
export const FADER_MAX_DB = 6;
/** Where 0 dB sits on the travel. */
export const UNITY_POSITION = 0.75;
/** The gain the language accepts at most. */
export const MAX_FADER_GAIN = 2;
/** Written gains have three decimals. */
const GAIN_DECIMALS = 3;
/** A gain written below the fader's floor (`gain 0.0005`) sits just above Off. */
export const BELOW_FLOOR_POSITION = 0.004;

const KNEE_POSITION = 0.25;
const KNEE_DB = -20;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** dB at a position 0..1; null is Off. */
export function positionToDb(position: number): number | null {
  const p = Number.isFinite(position) ? clamp(position, 0, 1) : 0;
  if (p <= 0) return null;
  if (p <= KNEE_POSITION) return FADER_MIN_DB + ((KNEE_DB - FADER_MIN_DB) / KNEE_POSITION) * p;
  if (p <= UNITY_POSITION) return KNEE_DB + (-KNEE_DB / (UNITY_POSITION - KNEE_POSITION)) * (p - KNEE_POSITION);
  return (FADER_MAX_DB / (1 - UNITY_POSITION)) * (p - UNITY_POSITION);
}

/** The position of a dB value; null (Off) is 0. Below −60 dB, just above Off. */
export function dbToPosition(db: number | null): number {
  if (db === null) return 0;
  if (db <= KNEE_DB) return Math.max(BELOW_FLOOR_POSITION, ((db - FADER_MIN_DB) / (KNEE_DB - FADER_MIN_DB)) * KNEE_POSITION);
  if (db <= 0) return KNEE_POSITION + ((db - KNEE_DB) / -KNEE_DB) * (UNITY_POSITION - KNEE_POSITION);
  return Math.min(1, UNITY_POSITION + (db / FADER_MAX_DB) * (1 - UNITY_POSITION));
}

/** Linear gain → dB; 0 (or less) is Off. */
export function gainToDb(gain: number): number | null {
  return gain > 0 ? 20 * Math.log10(gain) : null;
}

/** dB → the gain the text writes, three decimals; Off is 0. */
export function dbToGain(db: number | null): number {
  if (db === null) return 0;
  const scale = 10 ** GAIN_DECIMALS;
  const gain = Math.round(10 ** (db / 20) * scale) / scale;
  return clamp(gain, 1 / scale, MAX_FADER_GAIN);
}

/** The gain the text gets at a fader position (Off writes `gain 0`). */
export function positionToGain(position: number): number {
  return dbToGain(positionToDb(position));
}

/** Where a written gain puts the fader. */
export function gainToPosition(gain: number): number {
  return dbToPosition(gainToDb(gain));
}

/** "−6.0 dB", "+3.5 dB", "0.0 dB" or "Off", with the typographic minus a reader says "minus". */
export function formatDb(db: number | null): string {
  if (db === null) return "Off";
  const rounded = Math.round(db * 10) / 10;
  if (rounded === 0) return "0.0 dB";
  const sign = rounded < 0 ? "\u2212" : "+";
  return `${sign}${Math.abs(rounded).toFixed(1)} dB`;
}

/** The label of a written gain. */
export function gainLabel(gain: number): string {
  return formatDb(gainToDb(gain));
}

/** The arrow keys: `steps` of 0.5 dB. From Off, up is −60 dB; from −60 dB, down is Off. */
export function stepGain(gain: number, steps: number): number {
  const db = gainToDb(gain);
  if (db === null) return steps > 0 ? dbToGain(FADER_MIN_DB) : 0;
  const next = db + steps * 0.5;
  if (next < FADER_MIN_DB - 1e-9) return 0;
  const moved = dbToGain(Math.min(FADER_MAX_DB, next));
  // Above the fader's top (a hand-written `gain 2`), an arrow never moves against itself.
  if (Math.sign(moved - gain) === -Math.sign(steps)) return gain;
  // Near the floor three decimals are coarser than 0.5 dB: move one written step instead.
  if (moved !== gain || next >= FADER_MAX_DB) return moved;
  const unit = 10 ** -GAIN_DECIMALS;
  return clamp(Math.round((gain + Math.sign(steps) * unit) / unit) * unit, 0, MAX_FADER_GAIN);
}
