// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The timbre-distinctness matrix: render every preset of every instrument once, extract the
// mean MFCC and envelope, and run the gate's rules (./timbre-rules) over them. The protocol
// matches the timbre study's method: one track, no sends, tempo 120,
// a 2 s c3 (pitched and chord; the chord c3+eb3+g3 where a target asks for it) and a single
// hit for drums, from runSource. A whole-tone shift of the same preset is the ruler.
import type { InstrumentGroup, InstrumentManifest } from "@untzel/core";
import { extractFeatures, mfccDistance, type TimbreFeatures } from "./timbre";
import { partialLevelsDb, rmsSwingDb } from "./timbre-probes";
import { groupPairs, presetPairs, spectralViolation, targetPairs, withExceptions, type MeasuredSound, type RuleResult, type SpectralMeasure } from "./timbre-rules";
import { RECORDED_INSTRUMENTS } from "./recorded-instruments";
import { PAIR_TARGETS, SPECTRAL_TARGETS, TARGET_EXCEPTIONS, type SpectralTarget, type TargetRender } from "./timbre-targets";
import { simRegistry } from "../registry";
import { SAMPLE_RATE, runSource } from "../render/run";

const PITCHED_SECONDS = 4;
const DRUM_SECONDS = 6;
const C3_HZ = 130.8128;
const REFERENCE_NOTE = "c3";
/** A whole tone above c3; the "same sound a tone higher" ruler. */
const REFERENCE_NOTE_SHIFTED = "d3";
const CHORD = "c3+eb3+g3";
/** The supersaw's beating is read on the held part of the note, after the attack. */
const SWING_WINDOW_SECONDS: readonly [number, number] = [0.6, 1.9];

/** One sound: an instrument with one of its presets. */
export interface TimbreSubject {
  readonly instrument: string;
  readonly group: InstrumentGroup;
  readonly kind: InstrumentManifest["kind"];
  readonly preset: string;
  readonly isDefault: boolean;
  /** "<instrument> <preset>", the key of the matrix and of the targets. */
  readonly id: string;
}

export interface TimbreMatrix {
  readonly sampleRate: number;
  readonly reference: { readonly note: string; readonly shifted: string; readonly distance: number };
  readonly points: readonly {
    readonly id: string;
    readonly group: InstrumentGroup;
    readonly centroidHz: number;
    readonly attackSeconds: number;
    readonly decaySeconds: number;
    readonly harmonicToNoiseDb: number;
    readonly mfcc: readonly number[];
  }[];
  readonly pairs: readonly RuleResult[];
  readonly spectral: readonly SpectralMeasure[];
  readonly belowThreshold: readonly RuleResult[];
  readonly spectralFailures: readonly SpectralMeasure[];
  readonly summary: {
    readonly subjects: number;
    readonly presetPairsBelow: number;
    readonly sameGroupPairsBelow: number;
    readonly targetPairsBelow: number;
    readonly spectralBelow: number;
  };
}

/** Every preset of every manifest (`only` narrows to some instruments). */
export function subjectsOf(manifests: readonly InstrumentManifest[], only: ReadonlySet<string> | null = null): TimbreSubject[] {
  return manifests
    .filter((manifest) => only === null || only.has(manifest.name))
    .flatMap((manifest) =>
      manifest.presets.map((preset) => ({
        instrument: manifest.name,
        group: manifest.group,
        kind: manifest.kind,
        preset: preset.name,
        isDefault: preset.name === manifest.defaultPreset,
        id: `${manifest.name} ${preset.name}`,
      })),
    );
}

/** The study's patterns: one hit in three bars; an effect held for a bar; a held note. */
function patternOf(subject: TimbreSubject, note: string): string {
  if (subject.group === "fx") return "x~~~ ~~~~ ~~~~ ~~~~ / .... / ....";
  if (subject.kind === "drum") return "x... / .... / ....";
  return `${note} ~ ~ ~ / . . . . / . . . .`;
}

/** One track, no sends, tempo 120. */
export function subjectSource(subject: TimbreSubject, note: string, modifier = ""): string {
  const pattern = patternOf(subject, note);
  return `tempo 120\nkey c minor\nvoice: ${subject.instrument} ${subject.preset} ${pattern}${modifier === "" ? "" : ` | ${modifier}`}\n`;
}

/** The mono mix (L+R)/2 after the start frame. */
export function renderMono(source: string, seconds: number, wasm: WebAssembly.Module): Float32Array {
  const result = runSource(source, { name: "timbre", mode: "loop", seconds, bars: null, tracks: null, seed: null, wasm, calibration: null, now: () => 0, trackRms: false });
  if (!result.ok) throw new Error(`timbre render failed: ${result.diagnostics[0]?.message ?? "diagnostics"} in ${source}`);
  const audio = result.run.audio;
  if (audio === null) throw new Error("timbre render produced no audio (no WASM?)");
  const from = result.run.startFrame ?? 0;
  const mono = new Float32Array(audio.left.length - from);
  for (let i = 0; i < mono.length; i += 1) mono[i] = ((audio.left[from + i] ?? 0) + (audio.right[from + i] ?? 0)) / 2;
  return mono;
}

class Renderer {
  private readonly buffers = new Map<string, Float32Array>();
  constructor(private readonly wasm: WebAssembly.Module) {}
  /** A render kept for the point measurements (only those are cached: memory). */
  buffer(subject: TimbreSubject, note: string, modifier = ""): Float32Array {
    const key = `${subject.id}|${note}|${modifier}`;
    let buffer = this.buffers.get(key);
    if (buffer === undefined) {
      buffer = this.render(subject, note, modifier);
      this.buffers.set(key, buffer);
    }
    return buffer;
  }
  features(subject: TimbreSubject, note: string, modifier = ""): TimbreFeatures {
    const buffer = this.buffers.get(`${subject.id}|${note}|${modifier}`) ?? this.render(subject, note, modifier);
    return extractFeatures(buffer, { sampleRate: SAMPLE_RATE });
  }
  private render(subject: TimbreSubject, note: string, modifier: string): Float32Array {
    return renderMono(subjectSource(subject, note, modifier), subject.kind === "drum" ? DRUM_SECONDS : PITCHED_SECONDS, this.wasm);
  }
}

function measureSpectral(target: SpectralTarget, subject: TimbreSubject, renderer: Renderer, features: TimbreFeatures): number[] {
  switch (target.kind) {
    case "partials":
      return partialLevelsDb(renderer.buffer(subject, REFERENCE_NOTE), SAMPLE_RATE, C3_HZ, target.ratios);
    case "centroid":
      return [features.centroidHz];
    case "swing":
      return [rmsSwingDb(renderer.buffer(subject, REFERENCE_NOTE), SAMPLE_RATE, ...SWING_WINDOW_SECONDS)];
    case "decay":
      return [features.decaySeconds];
    case "tone":
      return [mfccDistance(renderer.features(subject, REFERENCE_NOTE, "tone 0").mfcc, renderer.features(subject, REFERENCE_NOTE, "tone 1").mfcc)];
  }
}

/** Builds the matrix. `only` (`--only a,b`) renders some instruments and skips the rest. */
export function buildMatrix(wasm: WebAssembly.Module, only: ReadonlySet<string> | null = null): TimbreMatrix {
  const { instruments } = simRegistry();
  const subjects = subjectsOf(instruments, only);
  const known = new Set(subjectsOf(instruments).map((subject) => subject.id));
  const byId = new Map(subjects.map((subject) => [subject.id, subject]));
  const renderer = new Renderer(wasm);
  const sounds: MeasuredSound[] = subjects.map((subject) => ({ ...subject, features: renderer.features(subject, REFERENCE_NOTE) }));
  const noteFeatures = new Map(sounds.map((sound) => [sound.id, sound.features]));
  const lookup = (id: string, render: TargetRender): TimbreFeatures | null | undefined => {
    const subject = byId.get(id);
    if (subject === undefined) return known.has(id) ? null : undefined;
    return render === "note" || subject.kind === "drum" ? noteFeatures.get(id) : renderer.features(subject, CHORD);
  };
  const pairs = [...presetPairs(sounds), ...groupPairs(sounds), ...targetPairs(PAIR_TARGETS, lookup)];
  const spectral = spectralMeasures(byId, known, renderer, noteFeatures);
  return matrixOf(subjects, sounds, pairs, spectral, renderer);
}

/** The b.1 measurements (partials, centroid, swing, decay, tone) of the subjects rendered. */
function spectralMeasures(
  byId: ReadonlyMap<string, TimbreSubject>,
  known: ReadonlySet<string>,
  renderer: Renderer,
  noteFeatures: ReadonlyMap<string, TimbreFeatures>,
): SpectralMeasure[] {
  const spectral: SpectralMeasure[] = [];
  for (const target of SPECTRAL_TARGETS) {
    // b.1 sets the partials and decays of the synthesis models; a recording has its own.
    if (RECORDED_INSTRUMENTS.has(target.subject.split(" ")[0] ?? "")) continue;
    const subject = byId.get(target.subject);
    if (subject === undefined) {
      if (!known.has(target.subject)) spectral.push({ target, values: [], violation: `${target.source}: no such sound ${target.subject}` });
      continue;
    }
    const values = measureSpectral(target, subject, renderer, noteFeatures.get(subject.id)!);
    const excepted = TARGET_EXCEPTIONS.some((entry) => entry.kind === target.kind && entry.subject === target.subject);
    spectral.push({ target, values: values.map(round), violation: withExceptions(target, spectralViolation(target, values), TARGET_EXCEPTIONS), excepted });
  }
  return spectral;
}

/** The matrix as the report and the JSON carry it: rounded points, pairs and the summary. */
function matrixOf(
  subjects: readonly TimbreSubject[],
  sounds: readonly MeasuredSound[],
  pairs: readonly RuleResult[],
  spectral: readonly SpectralMeasure[],
  renderer: Renderer,
): TimbreMatrix {
  const belowThreshold = pairs.filter((pair) => pair.violation !== null).sort((x, y) => x.distance - y.distance);
  const spectralFailures = spectral.filter((measure) => measure.violation !== null);
  const count = (rule: RuleResult["rule"]): number => belowThreshold.filter((pair) => pair.rule === rule).length;
  return {
    sampleRate: SAMPLE_RATE,
    reference: referenceDistance(subjects, renderer),
    points: sounds.map((sound) => ({
      id: sound.id,
      group: sound.group,
      centroidHz: round(sound.features.centroidHz),
      attackSeconds: round4(sound.features.attackSeconds),
      decaySeconds: round4(sound.features.decaySeconds),
      harmonicToNoiseDb: round(sound.features.harmonicToNoiseDb),
      mfcc: sound.features.mfcc.map(round4),
    })),
    pairs: pairs.map((pair) => ({ ...pair, distance: round4(pair.distance) })),
    spectral,
    belowThreshold: belowThreshold.map((pair) => ({ ...pair, distance: round4(pair.distance) })),
    spectralFailures,
    summary: {
      subjects: subjects.length,
      presetPairsBelow: count("preset"),
      sameGroupPairsBelow: count("group"),
      targetPairsBelow: count("target"),
      spectralBelow: spectralFailures.length,
    },
  };
}

/** The ruler: the default sound of the first pitched instrument, c3 against d3. */
function referenceDistance(subjects: readonly TimbreSubject[], renderer: Renderer): TimbreMatrix["reference"] {
  const pitched = subjects.find((subject) => subject.kind !== "drum" && subject.isDefault);
  if (pitched === undefined) return { note: REFERENCE_NOTE, shifted: REFERENCE_NOTE_SHIFTED, distance: 0 };
  const distance = mfccDistance(renderer.features(pitched, REFERENCE_NOTE).mfcc, renderer.features(pitched, REFERENCE_NOTE_SHIFTED).mfcc);
  return { note: REFERENCE_NOTE, shifted: REFERENCE_NOTE_SHIFTED, distance: round4(distance) };
}

const round = (value: number): number => Math.round(value * 10) / 10;
const round4 = (value: number): number => Math.round(value * 10000) / 10000;
