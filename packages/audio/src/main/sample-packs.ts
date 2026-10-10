// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Loads the sample packs of `vox` and `choir` only when a program plays them:
// a track whose resolved `source` (sound, preset and text applied) is `samples`. A text with
// only `vox talk` or `vox robot` sings on the formants and fetches nothing (it used to fetch
// the 360 KB vox pack). It fetches pack.json and pack.opus, decodes the Opus on the main thread and keeps the
// result, which goes to the worklet and to every export. Until a pack is ready its
// tracks sing on the formants; a pack that fails to load leaves them there (invalid or missing input never breaks the music).
// The URLs come from the composition; this module resolves none.

import type { InstrumentManifest, Program, Track } from "@untzel/core";
import { readPackManifest, samplePackData, type SamplePackData } from "../protocol";

/** Where one instrument's pack lives (Vite ?url assets of the composition). */
export interface SamplePackSource {
  readonly instrument: string;
  readonly manifestUrl: string;
  readonly audioUrl: string;
}

export interface SamplePackLoaderOptions {
  readonly sources: readonly SamplePackSource[];
  /** Registry names in instrumentId order. */
  readonly instruments: readonly string[];
  /**
   * The index of `samples` among each instrument's `source` choices (samplesChoices). An
   * instrument without an entry loads its pack whenever a track names it.
   */
  readonly samplesChoice?: ReadonlyMap<string, number>;
  /** Decodes the audio at the pack's rate. */
  readonly decode: (bytes: ArrayBuffer, sampleRate: number) => Promise<Float32Array>;
  readonly fetch: (url: string) => Promise<Response>;
  /** Called once per pack, when it is ready. */
  readonly onReady: (pack: SamplePackData) => void;
}

/** The index of `samples` in the `source` choices of each manifest that has one. */
export function samplesChoices(manifests: readonly Pick<InstrumentManifest, "name" | "parameters">[]): ReadonlyMap<string, number> {
  const choices = new Map<string, number>();
  for (const manifest of manifests) {
    const index = manifest.parameters.find((parameter) => parameter.name === "source")?.choices?.indexOf("samples") ?? -1;
    if (index >= 0) choices.set(manifest.name, index);
  }
  return choices;
}

/** The track sounds its instrument's samples: its resolved `source` is `samples`, or unknown. */
export function playsSamples(track: Pick<Track, "instrument" | "parameters">, samplesChoice: ReadonlyMap<string, number>): boolean {
  const samples = samplesChoice.get(track.instrument);
  const source = track.parameters.find((parameter) => parameter.name === "source")?.value;
  if (samples === undefined || source === undefined || source.kind !== "constant") return true;
  return source.value === samples;
}

/** decodeAudioData in an OfflineAudioContext at the pack's rate: no resampling, any page rate. */
export async function decodeWithWebAudio(bytes: ArrayBuffer, sampleRate: number): Promise<Float32Array> {
  const context = new OfflineAudioContext({ numberOfChannels: 1, length: 1, sampleRate });
  const buffer = await context.decodeAudioData(bytes);
  return buffer.getChannelData(0);
}

export class SamplePackLoader {
  readonly #options: SamplePackLoaderOptions;
  /** One promise per instrument, null when the pack could not be loaded. */
  readonly #loads = new Map<string, Promise<SamplePackData | null>>();

  constructor(options: SamplePackLoaderOptions) {
    this.#options = options;
  }

  /** Starts loading, once, the pack of every instrument the program's tracks play samples of. */
  want(program: Program): void {
    for (const instrument of this.#instrumentsOf(program)) this.#load(instrument);
  }

  /** The packs the program plays, once loaded (the export waits for them). */
  packsFor(program: Program): Promise<SamplePackData[]> {
    return this.packsForInstruments(this.#sampledInstruments(program));
  }

  /** The packs of these instrument names, once loaded: a take names its instruments, not one program. */
  async packsForInstruments(names: readonly string[]): Promise<SamplePackData[]> {
    const packs = await Promise.all(this.#withPacks(names).map((instrument) => this.#load(instrument)));
    return packs.filter((pack): pack is SamplePackData => pack !== null);
  }

  #instrumentsOf(program: Program): string[] {
    return this.#withPacks(this.#sampledInstruments(program));
  }

  #sampledInstruments(program: Program): string[] {
    const choices = this.#options.samplesChoice ?? new Map<string, number>();
    return program.tracks.filter((track) => playsSamples(track, choices)).map((track) => track.instrument);
  }

  /** The names among `names` that have a pack, in source order, once each. */
  #withPacks(names: readonly string[]): string[] {
    const used = new Set(names);
    return this.#options.sources.filter((source) => used.has(source.instrument)).map((source) => source.instrument);
  }

  #load(instrument: string): Promise<SamplePackData | null> {
    const existing = this.#loads.get(instrument);
    if (existing !== undefined) return existing;
    const load = this.#fetchAndDecode(instrument).then(
      (pack) => {
        if (pack !== null) this.#options.onReady(pack);
        return pack;
      },
      (error: unknown) => {
        console.warn(`Untzel: the ${instrument} samples did not load; it keeps its synth voice`, error);
        return null;
      },
    );
    this.#loads.set(instrument, load);
    return load;
  }

  async #fetchAndDecode(instrument: string): Promise<SamplePackData | null> {
    const source = this.#options.sources.find((entry) => entry.instrument === instrument);
    const instrumentId = this.#options.instruments.indexOf(instrument);
    if (source === undefined || instrumentId < 0) return null;
    const [manifestResponse, audioResponse] = await Promise.all([this.#options.fetch(source.manifestUrl), this.#options.fetch(source.audioUrl)]);
    if (!manifestResponse.ok || !audioResponse.ok) throw new Error(`HTTP ${manifestResponse.status}/${audioResponse.status}`);
    const read = readPackManifest(await manifestResponse.json());
    if (!read.ok) throw new Error(read.reason);
    const decoded = await this.#options.decode(await audioResponse.arrayBuffer(), read.manifest.sampleRate);
    const pack = samplePackData(read.manifest, instrumentId, decoded);
    if (pack === null) throw new Error(`decoded ${decoded.length} frames, the pack has ${read.manifest.frames}`);
    return pack;
  }
}
