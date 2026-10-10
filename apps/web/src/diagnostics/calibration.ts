// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// CPU meter calibration: starts as soon as the WASM compiles, before the tap. If
// the tap comes first, a calibration not yet started waits until 10 s after the first sound.
import {
  CALIBRATION_SAMPLE_RATE,
  LOADED_RUN_SECONDS,
  WARMUP_SECONDS,
  calibrate,
  instrumentHashes,
  scheduleOffline,
  type LoadMeter,
} from "@untzel/audio/main";
import type { InstrumentManifest, InstrumentRegistry, Program } from "@untzel/core";
import { analyze } from "@untzel/language";
import { Transport } from "@untzel/transport";

export const INSTANCES_PER_INSTRUMENT = 4;
export const DEFER_AFTER_FIRST_SOUND_MS = 10_000;

/**
 * One representative of each engine:
 * with 40 instruments, 8 instances of each would be 320 tracks.
 */
export const CALIBRATION_INSTRUMENTS: readonly string[] = [
  "kick",
  "hat",
  "bass",
  "pad",
  "epiano",
  "organ",
  "pluck",
  "piano",
  "choir",
  "clap",
  "strings",
];

/** 4 instances of each representative playing its defaultPattern at 132 BPM. */
export function calibrationSource(instruments: readonly InstrumentManifest[]): string {
  const lines = ["tempo 132"];
  const chosen = instruments.filter((manifest) => CALIBRATION_INSTRUMENTS.includes(manifest.name));
  for (const manifest of chosen.length > 0 ? chosen : instruments) {
    for (let i = 1; i <= INSTANCES_PER_INSTRUMENT; i += 1) {
      lines.push(`${manifest.name}${i}: ${manifest.name} ${manifest.defaultPattern}`);
    }
  }
  return lines.join("\n");
}

export interface CalibrationDependencies {
  readonly registry: InstrumentRegistry;
  readonly instruments: readonly InstrumentManifest[];
  readonly meter: LoadMeter;
}

export class CalibrationScheduler {
  readonly #dependencies: CalibrationDependencies;
  #started = false;
  #soundStarted = false;
  #tapped = false;
  #module: WebAssembly.Module | null = null;

  constructor(dependencies: CalibrationDependencies) {
    this.#dependencies = dependencies;
  }

  moduleReady(module: WebAssembly.Module): void {
    this.#module = module;
    if (!this.#tapped) this.#run();
  }

  /** The tap: a calibration not started yet must not compete with the first sound. */
  tapped(): void {
    this.#tapped = true;
  }

  soundStarted(): void {
    this.#tapped = true;
    if (this.#soundStarted) return;
    this.#soundStarted = true;
    if (!this.#started) setTimeout(() => this.#run(), DEFER_AFTER_FIRST_SOUND_MS);
  }

  #run(): void {
    const module = this.#module;
    if (this.#started || module === null) return;
    this.#started = true;
    this.#calibrate(module).catch((error: unknown) => {
      console.warn("Untzel CPU calibration failed; the meter shows CPU ~", error);
    });
  }

  async #calibrate(module: WebAssembly.Module): Promise<void> {
    const { registry, instruments, meter } = this.#dependencies;
    const result = analyze(calibrationSource(instruments), registry);
    if (!result.ok) throw new Error(`calibration text: ${result.diagnostics[0]?.message ?? ""}`);
    const program: Program = result.program;
    const loadedScore = scheduleOffline({
      createTransport: (clock, sink) => new Transport({ clock, sink }),
      program,
      instruments: instruments.map((manifest) => manifest.name),
      sampleRate: CALIBRATION_SAMPLE_RATE,
      seconds: WARMUP_SECONDS + LOADED_RUN_SECONDS,
    });
    const calibration = await calibrate({
      module,
      instrumentHashes: instrumentHashes(instruments),
      loadedScore,
      unitsOf: (from, to) => meter.unitsOf(program, to, from),
    });
    meter.calibrate(calibration);
  }
}
