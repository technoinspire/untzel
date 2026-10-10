// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Instance identity: the identity of a DSP instance is the track NAME. Reordering
// lines changes trackIndex, not the slot; renaming or changing the instrument of a name
// retires the old slot (its tail finishes) and creates a new one. Pure: tested in Node.
import type { WorkerToWorkletMessage } from "../protocol";
import type { DspExports } from "./dsp-exports";

export type InstanceDsp = Pick<
  DspExports,
  | "untzel_instance_create"
  | "untzel_param_set"
  | "untzel_param_push"
  | "untzel_instance_activate"
  | "untzel_instance_retire"
  | "untzel_effect_order"
  | "untzel_effects_commit"
  | "untzel_modulator_set"
  | "untzel_envelope_set"
  | "untzel_modulator_clear"
>;

type ActivatedTrackMessage = ProgramMessage["tracks"][number];
type ModulatorMessage = ActivatedTrackMessage["modulators"][number];

/** Calls that returned 1 (refused); the host adds them to unknownTargets. */
export interface Refusals {
  count: number;
}

export type ProgramMessage = Extract<WorkerToWorkletMessage, { readonly type: "program" }>;

/** untzel_instance_create returned u32::MAX (read as -1): the track stays mute. */
export const NO_SLOT = -1;
/** (generation, trackIndex) the table does not know: counted in unknownTargets. */
export const UNKNOWN_TARGET = -2;

interface Instance {
  readonly slot: number;
  readonly instrumentId: number;
  /** Last value sent to the slot, per parameter index. */
  readonly parameters: number[];
  /** Last effect order committed. */
  effects: readonly number[];
  /** Last modulators set, by parameter index. */
  modulators: ReadonlyMap<number, ModulatorMessage>;
}

interface Generation {
  readonly atFrame: number;
  /** Slot per trackIndex of that activation. */
  readonly slots: Int32Array;
}

export class InstanceTable {
  readonly #dsp: InstanceDsp;
  readonly #rampFrames: number;
  readonly #sampleRate: number;
  readonly #byName = new Map<string, Instance>();
  readonly #generations = new Map<number, Generation>();
  readonly refusals: Refusals = { count: 0 };

  constructor(dsp: InstanceDsp, sampleRate: number) {
    this.#dsp = dsp;
    this.#sampleRate = sampleRate;
    this.#rampFrames = Math.round(0.02 * sampleRate);
  }

  activate(program: ProgramMessage): void {
    const slots = new Int32Array(program.tracks.length);
    const names = new Set<string>();
    program.tracks.forEach((track, index) => {
      names.add(track.name);
      slots[index] = this.#resolve(track, program.atFrame);
    });
    for (const [name, instance] of this.#byName) {
      if (names.has(name)) continue;
      this.#retire(instance, program.atFrame);
      this.#byName.delete(name);
    }
    this.#generations.set(program.generation, { atFrame: program.atFrame, slots });
  }

  /** Slot for an event or point; NO_SLOT for a mute track, UNKNOWN_TARGET otherwise. */
  slotOf(generation: number, trackIndex: number): number {
    const slots = this.#generations.get(generation)?.slots;
    if (slots === undefined || trackIndex < 0 || trackIndex >= slots.length) return UNKNOWN_TARGET;
    return slots[trackIndex] ?? UNKNOWN_TARGET;
  }

  /**
   * Generation g is dropped once currentFrame >= atFrame(g + 1) + sampleRate. The
   * transport never emits an event of g after atFrame(g + 1); the second covers late ones.
   */
  discardGenerations(currentFrame: number): void {
    let previous: number | null = null;
    for (const [generation, { atFrame }] of this.#generations) {
      if (previous !== null && currentFrame >= atFrame + this.#sampleRate) {
        this.#generations.delete(previous);
      }
      previous = generation;
    }
  }

  /** Live instances, for the stats reply. */
  instances(): IterableIterator<[string, { readonly slot: number }]> {
    return this.#byName.entries();
  }

  /** Visible for tests. */
  generations(): readonly number[] {
    return [...this.#generations.keys()];
  }

  #resolve(track: ActivatedTrackMessage, atFrame: number): number {
    const previous = this.#byName.get(track.name);
    if (previous !== undefined && previous.instrumentId === track.instrumentId) {
      this.#update(previous, track.parameters, atFrame);
      this.#applySound(previous, track, atFrame);
      return previous.slot;
    }
    if (previous !== undefined) this.#retire(previous, atFrame);
    const created = this.#create(track.instrumentId, track.parameters, atFrame);
    this.#applySound(created, track, atFrame);
    this.#byName.set(track.name, created);
    return created.slot;
  }

  #create(instrumentId: number, parameters: readonly number[], atFrame: number): Instance {
    const slot = this.#dsp.untzel_instance_create(instrumentId);
    const empty = { instrumentId, parameters: [...parameters], effects: [], modulators: new Map() };
    if (slot < 0) return { slot: NO_SLOT, ...empty };
    parameters.forEach((value, index) => this.#dsp.untzel_param_set(slot, index, value));
    this.#dsp.untzel_instance_activate(slot, atFrame);
    return { slot, ...empty };
  }

  /** Effect order (at atFrame, crossfaded by the DSP) and modulators of one track. */
  #applySound(instance: Instance, track: ActivatedTrackMessage, atFrame: number): void {
    if (instance.slot === NO_SLOT) return;
    const dsp = this.#dsp;
    const slot = instance.slot;
    if (!sameNumbers(instance.effects, track.effects)) {
      track.effects.forEach((kind, position) => this.#check(dsp.untzel_effect_order(slot, position, kind)));
      this.#check(dsp.untzel_effects_commit(slot, track.effects.length, atFrame));
      instance.effects = [...track.effects];
    }
    const next = new Map(track.modulators.map((modulator) => [modulator.index, modulator]));
    for (const index of instance.modulators.keys()) {
      if (!next.has(index)) this.#check(dsp.untzel_modulator_clear(slot, index));
    }
    for (const [index, modulator] of next) {
      if (sameModulator(instance.modulators.get(index), modulator)) continue;
      this.#check(
        modulator.kind === "lfo"
          ? dsp.untzel_modulator_set(slot, index, modulator.shape, modulator.curve, modulator.periodFrames, modulator.originFrame, modulator.low, modulator.high)
          : dsp.untzel_envelope_set(slot, index, modulator.curve, modulator.seconds, modulator.low, modulator.high),
      );
    }
    instance.modulators = next;
  }

  #check(result: number): void {
    if (result !== 0) this.refusals.count += 1;
  }

  #update(instance: Instance, parameters: readonly number[], atFrame: number): void {
    parameters.forEach((value, index) => {
      if (instance.parameters[index] === value) return;
      instance.parameters[index] = value;
      if (instance.slot === NO_SLOT) return;
      this.#dsp.untzel_param_push(instance.slot, index, atFrame, value, this.#rampFrames);
    });
  }

  #retire(instance: Instance, atFrame: number): void {
    if (instance.slot !== NO_SLOT) this.#dsp.untzel_instance_retire(instance.slot, atFrame);
  }
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sameModulator(a: ModulatorMessage | undefined, b: ModulatorMessage): boolean {
  if (a === undefined || a.kind !== b.kind) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
