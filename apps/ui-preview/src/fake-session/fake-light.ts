// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The fake music's clock: every tick plays the fixture's tracks as light cues and as the
// editor's sounding ranges, moves queued tracks on each bar and redraws the screens.

import type { TextRange } from "@untzel/editor";
import type { LightCue, LightProgram, LightTimeline } from "@untzel/light";
import type { StepView, UntzelView } from "@untzel/presentation/view-model";
import { previewCue, previewProgram, previewTimeline } from "../preview-light";
import type { FakeState, Listener } from "./fake-state";
import { isAudible } from "./fake-view";

/** One delivery to the light stage. */
export interface PreviewLightBatch {
  readonly program: LightProgram;
  readonly cues: readonly LightCue[];
  readonly timeline: LightTimeline;
}

const LOOKAHEAD_S = 0.2;
const STILL_STEP_FRACTION = 2 / 16;
const STILL_CUE_AGE_S = 0.06;

function holdLength(steps: readonly StepView[], index: number): number {
  let length = 1;
  while (steps[(index + length) % steps.length]?.kind === "hold" && length < steps.length) length += 1;
  return length;
}

export class FakeLight {
  readonly #state: FakeState;
  readonly #view: () => UntzelView;
  readonly #exporter: { tick(seconds: number): void };
  readonly #cueListeners = new Set<Listener<PreviewLightBatch>>();
  #lightProgram: { readonly key: string; readonly program: LightProgram } | null = null;
  #scheduledUntil = 0;
  #lastBar = -1;
  #lastSoundingKey = "";
  #stillLit = false;

  constructor(state: FakeState, view: () => UntzelView, exporter: { tick(seconds: number): void }) {
    this.#state = state;
    this.#view = view;
    this.#exporter = exporter;
  }

  /** What the light stage receives through LightPort: the program, then cues on the music's clock. */
  onCues(listener: Listener<PreviewLightBatch>): () => void {
    this.#cueListeners.add(listener);
    return () => this.#cueListeners.delete(listener);
  }

  tick(): void {
    const state = this.#state;
    if (state.phase !== "running") return;
    const now = state.now();
    const barSeconds = state.barSeconds();
    const view = this.#view();
    const section = view.transport.section;
    const bar = Math.floor(now / barSeconds);
    if (!state.still && bar !== this.#lastBar) {
      this.#lastBar = bar;
      for (const track of state.tracks) {
        if (!track.isQueued) continue;
        track.isQueued = false;
        track.isOn = !track.isOn;
      }
    }
    this.#exporter.tick(performance.now() / 1000);
    if (state.isPlaying) {
      if (state.still) this.#lightStill(now, section);
      else this.#scheduleCues(now, section);
      this.#emitSounding(now / barSeconds, section);
    }
    state.emit();
  }

  #scheduleCues(now: number, section: string | null): void {
    const state = this.#state;
    const until = now + LOOKAHEAD_S;
    const from = Math.max(this.#scheduledUntil, now);
    if (until <= from) return;
    const barSeconds = state.barSeconds();
    const cues: LightCue[] = [];
    for (const track of state.tracks) {
      if (!isAudible(state, track, section) || track.steps.length === 0) continue;
      const stepSeconds = barSeconds / track.steps.length;
      const first = Math.ceil(from / stepSeconds);
      for (let index = first; index * stepSeconds < until; index += 1) {
        const step = track.steps[index % track.steps.length];
        if (step === undefined || step.kind === "rest" || step.kind === "hold") continue;
        const duration = stepSeconds * holdLength(track.steps, index % track.steps.length);
        cues.push(previewCue({ track: track.name, audioTime: index * stepSeconds, duration, isAccent: step.kind === "accent", tone: track.tone }, barSeconds));
      }
    }
    this.#scheduledUntil = until;
    if (cues.length > 0) this.#emitLight(cues, previewTimeline(now, barSeconds));
  }

  /** One cue per audible track, at the same age before the frozen clock: the same lit frame every time. */
  #lightStill(now: number, section: string | null): void {
    if (this.#stillLit) return;
    this.#stillLit = true;
    const state = this.#state;
    const stepSeconds = state.barSeconds() / 16;
    const cues: LightCue[] = [];
    for (const track of state.tracks) {
      const step = track.steps.find((entry) => entry.kind !== "rest" && entry.kind !== "hold");
      if (!isAudible(state, track, section) || step === undefined) continue;
      cues.push(previewCue({ track: track.name, audioTime: now - STILL_CUE_AGE_S, duration: stepSeconds * 2, isAccent: step.kind === "accent", tone: track.tone }, state.barSeconds()));
    }
    if (cues.length > 0) this.#emitLight(cues, previewTimeline(now, state.barSeconds()));
  }

  #emitLight(cues: readonly LightCue[], timeline: LightTimeline): void {
    const tracks = this.#state.tracks.map((track) => ({ name: track.name, instrument: track.instrument, pan: (track.fixture.mix.find((entry) => entry.name === "pan")?.fraction ?? 0.5) * 2 - 1 }));
    const key = tracks.map((track) => `${track.name}:${track.instrument}`).join(",");
    if (this.#lightProgram?.key !== key) this.#lightProgram = { key, program: previewProgram(tracks) };
    for (const listener of this.#cueListeners) listener({ program: this.#lightProgram.program, cues, timeline });
  }

  #emitSounding(barPosition: number, section: string | null): void {
    const state = this.#state;
    const fraction = state.still ? STILL_STEP_FRACTION : barPosition % 1;
    const ranges: TextRange[] = [];
    for (const track of state.tracks) {
      if (!isAudible(state, track, section)) continue;
      const indexed = state.indexed.find((entry) => entry.name === track.name);
      if (indexed === undefined || indexed.steps.length === 0) continue;
      const at = Math.floor(fraction * indexed.steps.length);
      // The token that is sounding: the latest step at or before now that is not a rest.
      for (let index = at; index >= 0; index -= 1) {
        const step = indexed.steps[index];
        if (step !== undefined && !step.isRest) {
          if (state.still || index === at) ranges.push(step.range);
          break;
        }
      }
    }
    const key = ranges.map((range) => `${range.from}-${range.to}`).join(",");
    if (key === this.#lastSoundingKey) return;
    this.#lastSoundingKey = key;
    for (const listener of state.soundingListeners) listener(ranges);
  }
}
