// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// What a simulation measured: report.json and events.txt. Pure functions over a run.

import { denominator, midiToNoteName, numerator, pitchClassName, type EventValue, type Program } from "@untzel/core";
import type { RenderedAudio, SimulatedEvent, SimulationRun, TempoSegment } from "./simulate";

const SILENCE_DBFS = -240;

export interface AudioSummary {
  readonly peakDbfs: number;
  readonly rmsDbfs: number;
  readonly nonFinite: number;
  readonly clippedSamples: number;
}

export interface KickDrift {
  /** |lastOnsetFrame − (startFrame + floor((onsetCount − 1) × 60 × sr / bpm))|, M17. */
  readonly samples: number | null;
  readonly track: string | null;
  readonly onsetCount: number;
  /** Why samples is null, when it is. */
  readonly note: string | null;
}

export interface TrackReport {
  readonly instrument: string;
  readonly events: number;
  /** The track rendered alone through the same chain; null when skipped. */
  readonly rmsDbfs: number | null;
  /** costPerVoice × average sounding voices × calibrated cost per unit, fraction of real time; null uncalibrated. */
  readonly estimatedLoad: number | null;
}

export interface TrackLevelReport {
  /** RMS and peak of the track after gain, before pan and the master, in one render. */
  readonly rmsDbfs: number;
  readonly peakDbfs: number;
}

export interface PartReport {
  readonly part: number;
  readonly section: string;
  /** Bar since play where the part starts. */
  readonly fromBar: number;
  readonly bars: number;
  /** RMS of the master over the part; null when the render ended before it. */
  readonly rmsDbfs: number | null;
}

export interface SimulationReport {
  readonly name: string;
  readonly mode: string;
  readonly sampleRate: number;
  readonly durationSeconds: number;
  readonly startFrame: number | null;
  readonly audio: AudioSummary | null;
  readonly tracks: Readonly<Record<string, TrackReport>>;
  readonly kickDrift: KickDrift;
  readonly counters: {
    readonly lateDrops: number;
    readonly queueDrops: number;
    readonly nanResets: number;
    readonly unknownTargets: number;
  } | null;
  readonly render: {
    readonly dspMs: number;
    readonly transportMs: number;
    /** DSP render time / audio duration: the share of real time the worklet would use. */
    readonly realtimeFactor: number;
    readonly transportMsPerTick: number;
  };
  readonly estimatedLoad: number | null;
  readonly songEnded: boolean;
  /** Every track, measured before the master; no track limit. */
  readonly trackPreMaster: Readonly<Record<string, TrackLevelReport>>;
  /** BS.1770-4 integrated loudness of the master; null without the DSP. */
  readonly loudnessLufs: number | null;
  readonly shortTermMaxLufs: number | null;
  /** Song mode: the master RMS of every part of the song, in order. */
  readonly partRmsDbfs: readonly PartReport[];
}

export function dbfs(linear: number): number {
  return linear > 0 ? 20 * Math.log10(linear) : SILENCE_DBFS;
}

export function summarizeAudio(audio: RenderedAudio, fromFrame = 0): AudioSummary {
  let peak = 0;
  let sum = 0;
  let count = 0;
  let nonFinite = 0;
  let clipped = 0;
  for (const channel of [audio.left, audio.right]) {
    for (let index = fromFrame; index < channel.length; index += 1) {
      const sample = channel[index] ?? 0;
      if (!Number.isFinite(sample)) {
        nonFinite += 1;
        continue;
      }
      const magnitude = Math.abs(sample);
      if (magnitude > peak) peak = magnitude;
      if (magnitude >= 1) clipped += 1;
      sum += sample * sample;
      count += 1;
    }
  }
  return {
    peakDbfs: dbfs(peak),
    rmsDbfs: dbfs(count === 0 ? 0 : Math.sqrt(sum / count)),
    nonFinite,
    clippedSamples: clipped,
  };
}

export function noteName(midi: number): string {
  return midiToNoteName(midi) ?? `${pitchClassName(midi)}${Math.floor(midi / 12) - 1}`;
}

export function valueText(value: EventValue): string {
  switch (value.kind) {
    case "hit":
      return value.accent ? "X" : "x";
    case "note":
      return noteName(value.midi);
    case "chord":
      return value.midis.map(noteName).join("+");
  }
}

/** Bars since play at `frame`, from the tempo segments the transport announced. */
export function barAt(frame: number, tempo: readonly TempoSegment[], sampleRate: number): number {
  let segment: TempoSegment | undefined;
  for (const candidate of tempo) {
    if (candidate.frame <= frame) segment = candidate;
    else break;
  }
  if (segment === undefined) return 0;
  return segment.bar + ((frame - segment.frame) * segment.bpm) / (240 * sampleRate);
}

/** One line per event: bar, beat, frame, track, value, source range. Deterministic. */
export function eventLines(run: SimulationRun): string {
  const lines = ["bar\tbeat\tframe\ttrack\tvalue\tsource"];
  const sorted = [...run.events].sort((a, b) => a.frame - b.frame || a.track.localeCompare(b.track) || a.from - b.from);
  for (const event of sorted) {
    const position = barAt(event.frame, run.tempo, run.sampleRate) + 1e-9;
    const bar = Math.floor(position);
    const beat = (position - bar) * 4 + 1;
    lines.push(
      `${bar + 1}\t${beat.toFixed(3)}\t${event.frame}\t${event.track}\t${valueText(event.value)}\t${event.from}..${event.to}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function eventsPerTrack(events: readonly SimulatedEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.track, (counts.get(event.track) ?? 0) + 1);
  return counts;
}

/**
 * In loop mode at a constant tempo, a kick on every beat has its n-th onset at
 * startFrame + floor((n − 1) × 60 × sr / bpm), computed here in exact integers.
 */
export function kickDrift(run: SimulationRun, program: Program): KickDrift {
  const kick = program.tracks.find((track) => track.instrument === "kick" && !track.muted) ?? null;
  const base = { track: kick?.name ?? null, onsetCount: 0 };
  if (kick === null) return { ...base, samples: null, note: "no kick track" };
  const instance = run.stats?.instances.find((entry) => entry.name === kick.name);
  if (instance === undefined || run.startFrame === null) return { ...base, samples: null, note: "no DSP stats" };
  const onsetCount = instance.onsetCount;
  const counted = { track: kick.name, onsetCount };
  if (run.tempo.length !== 1) return { ...counted, samples: null, note: "needs one tempo" };
  if (run.mode === "song") return beatGridDrift(run, program, kick.name, instance, counted);
  const frames = run.events.filter((event) => event.track === kick.name).map((event) => event.frame);
  const beatFrames = (60 * run.sampleRate) / (run.tempo[0]?.bpm ?? 1);
  const everyBeat = frames.every((frame, index) => Math.abs(frame - (frames[0] ?? 0) - index * beatFrames) < 1);
  if (!everyBeat || frames[0] !== run.startFrame) return { ...counted, samples: null, note: "kick is not on every beat" };
  if (onsetCount < 1) return { ...counted, samples: null, note: "the kick never sounded" };
  const bpmNumerator = numerator(program.tempo);
  const bpmDenominator = denominator(program.tempo);
  const offset = (BigInt(onsetCount - 1) * 60n * BigInt(run.sampleRate) * bpmDenominator) / bpmNumerator;
  const expected = run.startFrame + Number(offset);
  return { ...counted, samples: Math.abs(instance.lastOnsetFrame - expected), note: null };
}

/** An event further than this from the nearest beat is not a beat kick (drift is samples). */
const OFF_BEAT = 0.25;

/**
 * Song mode at one tempo: the kick rests in some parts, so onsets cannot be counted from
 * the start. Every kick event must sit on beat b at startFrame + floor(b × 60 × sr / bpm),
 * in exact integers, which also puts each part start on startFrame + floor(start × 240 ×
 * sr / bpm); and the DSP's last onset must be the last kick event.
 */
function beatGridDrift(
  run: SimulationRun,
  program: Program,
  name: string,
  instance: { readonly lastOnsetFrame: number },
  counted: { readonly track: string; readonly onsetCount: number },
): KickDrift {
  const startFrame = run.startFrame ?? 0;
  const frames = run.events.filter((event) => event.track === name).map((event) => event.frame);
  if (frames.length === 0 || counted.onsetCount < 1) return { ...counted, samples: null, note: "the kick never sounded" };
  const bpmNumerator = numerator(program.tempo);
  const bpmDenominator = denominator(program.tempo);
  const beatScale = 60n * BigInt(run.sampleRate) * bpmDenominator;
  const beatFrames = Number(beatScale) / Number(bpmNumerator);
  let worst = 0;
  for (const frame of frames) {
    const beats = (frame - startFrame) / beatFrames;
    const beat = Math.round(beats);
    if (Math.abs(beats - beat) > OFF_BEAT) return { ...counted, samples: null, note: "kick is not on every beat" };
    const expected = startFrame + Number((BigInt(beat) * beatScale) / bpmNumerator);
    worst = Math.max(worst, Math.abs(frame - expected));
  }
  const last = frames.reduce((latest, frame) => Math.max(latest, frame), 0);
  worst = Math.max(worst, Math.abs(instance.lastOnsetFrame - last));
  return { ...counted, samples: worst, note: null };
}

export function trackPreMaster(levels: ReadonlyMap<string, { readonly sumSquares: number; readonly frames: number; readonly peak: number }>): Record<string, TrackLevelReport> {
  const out: Record<string, TrackLevelReport> = {};
  for (const [name, level] of levels) {
    out[name] = {
      rmsDbfs: dbfs(level.frames > 0 ? Math.sqrt(level.sumSquares / level.frames) : 0),
      peakDbfs: dbfs(level.peak),
    };
  }
  return out;
}

/** Frame of a bar since play, from the tempo segments (inverse of barAt). */
export function frameOfBar(bar: number, tempo: readonly TempoSegment[], sampleRate: number): number | null {
  let segment: TempoSegment | undefined;
  for (const candidate of tempo) {
    if (candidate.bar <= bar + 1e-9) segment = candidate;
    else break;
  }
  if (segment === undefined) return null;
  return Math.round(segment.frame + ((bar - segment.bar) * 240 * sampleRate) / segment.bpm);
}

/** RMS of the master in every part of the song (song mode, from play). */
export function partRms(run: SimulationRun, program: Program): PartReport[] {
  if (run.mode !== "song" || program.song === null || run.audio === null) return [];
  const parts: PartReport[] = [];
  let fromBar = 0;
  program.song.parts.forEach((part, index) => {
    const from = frameOfBar(fromBar, run.tempo, run.sampleRate);
    const to = frameOfBar(fromBar + part.bars, run.tempo, run.sampleRate);
    let rmsDbfs: number | null = null;
    if (from !== null && to !== null && to <= run.frames && run.audio !== null) {
      let sum = 0;
      for (const channel of [run.audio.left, run.audio.right]) {
        for (let n = from; n < to; n += 1) sum += (channel[n] ?? 0) ** 2;
      }
      rmsDbfs = dbfs(Math.sqrt(sum / (2 * Math.max(1, to - from))));
    }
    parts.push({ part: index, section: part.section, fromBar, bars: part.bars, rmsDbfs });
    fromBar += part.bars;
  });
  return parts;
}
