// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// CPU meter (LoadPort). fraction 1 = a full render quantum.
//
//   fraction = fixedFraction + units x fractionPerUnit
//   units    = sum over instances of costPerVoice x average sounding voices
//
// The average comes from the DSP's voiceFrames (sum of activeVoices x frames), read
// twice: (voiceFrames now - voiceFrames before) / frames between the readings. The
// calibration measures fixedFraction with an offline render without instances and
// fractionPerUnit with one where every instance plays its defaultPattern, counting the
// units of that render the same way, so the live meter and the calibration agree on
// what a unit is. (Counting one voice per instance there, as before, made the meter read
// 0.7x of the real cost: a kick averages 1.46 voices, a hat 0.2, measured in tools/sim.)
import type { InstrumentManifest, Program } from "@untzel/core";
import type { LoadEstimate, LoadPort, LoadReading } from "@untzel/session";
import type { WorkletStats } from "../protocol";

export interface Calibration {
  readonly fixedFraction: number;
  readonly fractionPerUnit: number;
}

export interface RenderTiming {
  /** Wall time of startRendering, in milliseconds. */
  readonly renderMs: number;
  /** Length of the rendered audio, in seconds. */
  readonly audioSeconds: number;
}

/** factor = (render time / audio duration) / estimated units. */
export function calibrationFromRuns(
  empty: RenderTiming,
  loaded: RenderTiming & { readonly units: number },
): Calibration {
  const ratio = (run: RenderTiming) => run.renderMs / 1000 / run.audioSeconds;
  const fixedFraction = ratio(empty);
  const fractionPerUnit = Math.max(0, ratio(loaded) - fixedFraction) / loaded.units;
  return { fixedFraction, fractionPerUnit };
}

/**
 * Units of a stretch of rendering: each instance's cost times its average sounding
 * voices between `from` (null: the start, frame 0, no voices) and `to`.
 */
export function averageUnits(
  from: WorkletStats | null,
  to: WorkletStats,
  costOf: (instance: string) => number,
): number {
  const frames = to.frame - (from?.frame ?? 0);
  let units = 0;
  for (const instance of to.instances) {
    const before = from?.instances.find((entry) => entry.name === instance.name)?.voiceFrames ?? 0;
    // A reused slot restarts at zero: count from there.
    const voiceFrames = instance.voiceFrames >= before ? instance.voiceFrames - before : instance.voiceFrames;
    const voices = frames > 0 ? voiceFrames / frames : instance.activeVoices;
    units += costOf(instance.name) * voices;
  }
  return units;
}

export class LoadMeter implements LoadPort {
  readonly #costByInstrument: ReadonlyMap<string, number>;
  #instrumentByTrack = new Map<string, string>();
  #calibration: Calibration | null = null;
  #previous: WorkletStats | null = null;
  #units = 0;
  #calibrated: ((calibration: Calibration) => void)[] = [];

  constructor(instruments: readonly InstrumentManifest[]) {
    this.#costByInstrument = new Map(instruments.map((m) => [m.name, m.costPerVoice]));
  }

  calibrate(calibration: Calibration): void {
    this.#calibration = calibration;
    for (const listener of this.#calibrated) listener(calibration);
  }

  /** Calls `listener` with the calibration now if there is one, and with every later one. */
  onCalibrated(listener: (calibration: Calibration) => void): void {
    this.#calibrated.push(listener);
    if (this.#calibration !== null) listener(this.#calibration);
  }

  /** The calibration in use, for the scale test's report; null before it ends. */
  calibration(): Calibration | null {
    return this.#calibration;
  }

  /** The program handed to the transport; maps instance names to instruments. */
  track(program: Program): void {
    this.#instrumentByTrack = new Map(program.tracks.map((t) => [t.name, t.instrument]));
  }

  /** Every stats reading of the worklet; the units are averaged since the previous one. */
  observe(stats: WorkletStats): void {
    const previous = this.#previous !== null && this.#previous.frame < stats.frame ? this.#previous : null;
    this.#units = averageUnits(previous, stats, (name) => this.#cost(this.#instrumentByTrack.get(name)));
    this.#previous = stats;
  }

  /** Units of a render of `program` between two readings (offline calibration, the simulator). */
  unitsOf(program: Program, to: WorkletStats, from: WorkletStats | null = null): number {
    const instruments = new Map(program.tracks.map((track) => [track.name, track.instrument]));
    return averageUnits(from, to, (name) => this.#cost(instruments.get(name)));
  }

  /** Before a program plays: one sounding voice per instance, a first guess. */
  estimate(program: Program): LoadEstimate {
    const units = program.tracks.reduce((sum, t) => sum + this.#cost(t.instrument), 0);
    return { units, fraction: this.#fraction(units) };
  }

  current(): LoadReading {
    return { fraction: this.#fraction(this.#units), calibrated: this.#calibration !== null };
  }

  #cost(instrument: string | undefined): number {
    return instrument === undefined ? 0 : (this.#costByInstrument.get(instrument) ?? 0);
  }

  #fraction(units: number): number | null {
    const calibration = this.#calibration;
    if (calibration === null) return null;
    return calibration.fixedFraction + units * calibration.fractionPerUnit;
  }
}
