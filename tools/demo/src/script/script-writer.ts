// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentManifest, InstrumentRegistry, Track } from "@untzel/core";
import { analyze } from "@untzel/language";
import type { DemoAction, DemoLayer, LayerRole } from "../actions";
import { addTrackAsTheSession, replayAction } from "./replay";

/**
 * Writes a script while keeping the text it builds, so each gesture is chosen against
 * the text as it is at that moment (the default pattern of a new track, a resampled bar).
 * Lives only for one buildDemoScript call.
 */
export class ScriptWriter {
  readonly #registry: InstrumentRegistry;
  readonly #layers: DemoLayer[] = [];
  #actions: DemoAction[] = [];
  #source = "";

  constructor(registry: InstrumentRegistry) {
    this.#registry = registry;
  }

  /** Applies the action to the text being built and records it in the open layer. */
  do(action: DemoAction): void {
    const result = replayAction(this.#source, action, this.#registry);
    if (!result.ok) throw new Error(`demo action ${action.kind} failed: ${result.reason}`);
    this.#source = result.source;
    this.#actions.push(action);
  }

  /** Adds a track the way the Add track sheet does, with its sound, and returns the name it got. */
  addTrack(manifest: InstrumentManifest, preset: string | null): string {
    const result = addTrackAsTheSession(this.#source, manifest, preset, this.#registry);
    if (!result.ok) throw new Error(`addTrack ${manifest.name} failed: ${result.reason}`);
    this.do({ kind: "addTrack", instrument: manifest.name, track: result.name, preset });
    return result.name;
  }

  /** The track as the text being built has it now. */
  track(name: string): Track {
    const analysis = analyze(this.#source, this.#registry);
    const track = analysis.ok ? analysis.program.tracks.find((candidate) => candidate.name === name) : undefined;
    if (track === undefined) throw new Error(`track ${name} is not in the text being built`);
    return track;
  }

  /** Closes the open layer; a layer with no action is dropped. */
  closeLayer(name: string, role: LayerRole): void {
    if (this.#actions.length > 0) this.#layers.push({ name, role, actions: this.#actions });
    this.#actions = [];
  }

  /** The text built so far. */
  source(): string {
    return this.#source;
  }
  layers(): readonly DemoLayer[] {
    return [...this.#layers];
  }
}
