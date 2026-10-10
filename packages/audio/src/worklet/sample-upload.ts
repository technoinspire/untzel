// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Copies a decoded sample pack into the DSP's memory through untzel_samples_*
// (packages/dsp/ABI.md, "Sample packs"). Message handler only: the reserve allocates.
// uploadSamples copies a whole pack at once (the export and the simulator, off the audio
// thread); the worklet takes it in pieces through ChunkedUpload.

import { ZONE_CELLS, type SamplePackData } from "../protocol";
import type { DspExports } from "./dsp-exports";

type SampleExports = Pick<
  DspExports,
  "memory" | "untzel_samples_reserve" | "untzel_samples_pcm_ptr" | "untzel_samples_zones_ptr" | "untzel_samples_commit"
>;

/** Reserves, copies and commits `pack` from `atFrame`; false when the DSP refused it. */
export function uploadSamples(dsp: SampleExports, pack: SamplePackData, atFrame: number): boolean {
  const zones = pack.zones.length / ZONE_CELLS;
  if (!Number.isInteger(zones) || dsp.untzel_samples_reserve(pack.instrumentId, pack.pcm.length, zones, pack.sampleRate) !== 0) {
    return false;
  }
  // Read the buffer after the reserve: the memory may have grown.
  const buffer = dsp.memory.buffer;
  new Int16Array(buffer, dsp.untzel_samples_pcm_ptr(), pack.pcm.length).set(pack.pcm);
  new Float64Array(buffer, dsp.untzel_samples_zones_ptr(), pack.zones.length).set(pack.zones);
  return dsp.untzel_samples_commit(atFrame) === 0;
}

/** One pack arriving in pieces (begin, chunks, commit); a refused begin drops the rest. */
export class ChunkedUpload {
  readonly #dsp: SampleExports;
  #frames = 0;
  #isReserved = false;
  constructor(dsp: SampleExports) {
    this.#dsp = dsp;
  }
  begin(instrumentId: number, frames: number, zones: Float64Array, sampleRate: number): void {
    const count = zones.length / ZONE_CELLS;
    this.#isReserved = Number.isInteger(count) && this.#dsp.untzel_samples_reserve(instrumentId, frames, count, sampleRate) === 0;
    this.#frames = frames;
    if (this.#isReserved) new Float64Array(this.#dsp.memory.buffer, this.#dsp.untzel_samples_zones_ptr(), zones.length).set(zones);
  }
  copy(offset: number, pcm: Int16Array): void {
    if (!this.#isReserved || offset < 0 || offset + pcm.length > this.#frames) return;
    new Int16Array(this.#dsp.memory.buffer, this.#dsp.untzel_samples_pcm_ptr() + offset * 2, pcm.length).set(pcm);
  }
  /** False when the begin was refused or the DSP refuses the commit. */
  commit(atFrame: number): boolean {
    const applied = this.#isReserved && this.#dsp.untzel_samples_commit(atFrame) === 0;
    this.#isReserved = false;
    return applied;
  }
}
