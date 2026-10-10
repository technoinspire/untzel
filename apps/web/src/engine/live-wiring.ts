// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the engine's sound feeds while the music runs: the editor's sounding lines, the
// light stage's cues, the stop at the end of a song, and the readings the test build's
// hooks report. Part of the boot chunk.
import type { Engine, EngineStats } from "@untzel/audio/main";
import type { InstrumentRegistry } from "@untzel/core";
import type { Session } from "@untzel/session";
import { LightCueMapper, deliverActivation, deliverBatch } from "@untzel/light";
import type { SoundingFeed } from "../adapters/code-port";
import type { RunningControls } from "../adapters/session-controls-port";
import type { LightRelay } from "../page/light-relay";
import { stageKeepOut } from "../stage/stage-keep-out";

/** Read by the test hooks only (vite build --mode test). */
export interface EngineReadings {
  stats: EngineStats | null;
  /** The frame the first bar 0 was scheduled at; the hooks reset it. */
  startFrame: number | null;
}

export function wireSound(engine: Engine, session: Session, controls: RunningControls, sounding: SoundingFeed, readings: EngineReadings): void {
  engine.sound.onScheduled(({ batch, sampleRate, outputLatency }) => {
    if (readings.startFrame === null && batch.position.bar === 0) readings.startFrame = batch.position.frame;
    sounding.push(batch, sampleRate, outputLatency);
  });
  engine.sound.onStats((stats) => (readings.stats = stats));
  engine.sound.onEnded(() => controls.playback.stop());
  session.subscribe((view) => {
    if (!view.playing) sounding.clear();
  });
}

export function wireLight(engine: Engine, session: Session, registry: InstrumentRegistry, light: LightRelay): void {
  const mapper = new LightCueMapper(registry, stageKeepOut());
  light.useClock(engine.clock);
  engine.sound.onActivation((activation) => deliverActivation(light, mapper.activate(activation, engine.clock.sampleRate)));
  engine.sound.onScheduled(({ batch, sampleRate }) => deliverBatch(light, mapper.cues(batch, sampleRate)));
  session.subscribe((view) => light.setMode(view.playing ? "live" : "idle"));
}
