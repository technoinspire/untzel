// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Sample packs: the pack manifest (`instruments/<name>/samples/v1/pack.json`)
// and the decoded pack every DSP host receives. The same functions turn the decoded
// audio into the DSP's tables on the page, in the export and in the simulator, so the
// three play the same numbers.

/** f64 cells of one zone in untzel_samples_zones_ptr() (packages/dsp/ABI.md). */
export const ZONE_CELLS = 8;

/** A decoded pack, ready for untzel_samples_*. Plain data: structured-clones to any thread. */
export interface SamplePackData {
  /** Position of the instrument in the registry (instrumentId). */
  readonly instrumentId: number;
  readonly sampleRate: number;
  /** Mono 16-bit PCM. */
  readonly pcm: Int16Array;
  /** ZONE_CELLS f64 per zone. */
  readonly zones: Float64Array;
}

export interface PackZone {
  readonly position: number;
  readonly lowest: number;
  readonly highest: number;
  readonly root: number;
  readonly start: number;
  readonly loopStart: number;
  readonly loopEnd: number;
  readonly pan: number;
}

/** What the engine needs from pack.json; the provenance fields are for people. */
export interface PackManifest {
  readonly instrument: string;
  readonly sampleRate: number;
  readonly frames: number;
  readonly zones: readonly PackZone[];
}

const FORMAT = 1;
const ZONE_FIELDS = ["position", "lowest", "highest", "root", "start", "loopStart", "loopEnd", "pan"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function readZone(value: unknown): PackZone | null {
  if (!isRecord(value) || !ZONE_FIELDS.every((field) => isNumber(value[field]))) return null;
  const cell = (field: (typeof ZONE_FIELDS)[number]): number => value[field] as number;
  return {
    position: cell("position"),
    lowest: cell("lowest"),
    highest: cell("highest"),
    root: cell("root"),
    start: cell("start"),
    loopStart: cell("loopStart"),
    loopEnd: cell("loopEnd"),
    pan: cell("pan"),
  };
}

/** pack.json as the engine reads it, or the reason it cannot be read. */
export function readPackManifest(value: unknown): { readonly ok: true; readonly manifest: PackManifest } | { readonly ok: false; readonly reason: string } {
  if (!isRecord(value) || value["format"] !== FORMAT) return { ok: false, reason: `not a format ${FORMAT} pack` };
  const { instrument, sampleRate, frames, zones } = value;
  if (typeof instrument !== "string" || !isNumber(sampleRate) || !isNumber(frames) || !Array.isArray(zones)) {
    return { ok: false, reason: "instrument, sampleRate, frames or zones missing" };
  }
  const read = zones.map(readZone);
  if (read.length === 0 || read.some((zone) => zone === null)) return { ok: false, reason: "a zone is malformed" };
  return { ok: true, manifest: { instrument, sampleRate, frames, zones: read as PackZone[] } };
}

/**
 * The DSP tables of a pack from its decoded audio. Null when the decoder did not give
 * back exactly the frames the pack was built with: the zones would point at the wrong
 * audio, so the track stays on its synthesis engine.
 */
export function samplePackData(manifest: PackManifest, instrumentId: number, decoded: Float32Array): SamplePackData | null {
  if (decoded.length !== manifest.frames) return null;
  const pcm = new Int16Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    const x = Math.max(-1, Math.min(1, decoded[index] ?? 0));
    pcm[index] = Math.round(x * 32_767);
  }
  const zones = new Float64Array(manifest.zones.length * ZONE_CELLS);
  manifest.zones.forEach((zone, index) => {
    zones.set(ZONE_FIELDS.map((field) => zone[field]), index * ZONE_CELLS);
  });
  return { instrumentId, sampleRate: manifest.sampleRate, pcm, zones };
}
