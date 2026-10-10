// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The simulator's command line (usage in cli.ts): one declarative table of options, each
// reading its own value, and the rules that join them. A bad argument is a UsageError (exit 2).
import type { PlaybackMode } from "@untzel/session";
import { CLOCK_KINDS, type ClockKind } from "./render/clock";

export interface Arguments {
  readonly file: string | null;
  readonly bars: number | null;
  readonly seconds: number | null;
  readonly tracks: number | null;
  readonly out: string | null;
  readonly seed: number | null;
  readonly mode: PlaybackMode;
  readonly scale: boolean;
  readonly golden: boolean;
  readonly update: boolean;
  readonly costs: boolean;
  readonly levels: boolean;
  readonly gain: boolean;
  /** Units of the meter the simulated device takes; turns the CPU protection check on. */
  readonly capacity: number | null;
  /** Renders this section (or every one) as the loop section. */
  readonly section: string | null;
  readonly rounds: number;
  /** What times the renders: elapsed time (default) or this thread's CPU time. */
  readonly clock: ClockKind;
  /** vox and choir on the formants, as before their packs arrive. */
  readonly samples: boolean;
  /** The play range: bars A–B, from the start or handed in after S seconds. */
  readonly range: { readonly startBar: number; readonly endBar: number; readonly cycle: boolean } | null;
  readonly rangeAt: number | null;
  readonly timbre: boolean;
  /** --fail-closed turns the timbre thresholds into a non-zero exit. */
  readonly failClosed: boolean;
  /** --only a,b: the timbre matrix of some instruments (no templates). */
  readonly only: ReadonlySet<string> | null;
  /** --templates: the main section of every template as WAV. */
  readonly templates: boolean;
  /** --take <file>: a recorded take, rendered as the export does. */
  readonly take: string | null;
  /** --from-arm: the take from its arm, as a video's sound track (the demo). */
  readonly fromArm: boolean;
}

export class UsageError extends Error {}

/** The arguments while they are read; --cycle applies to --range once every option is in. */
type Draft = { -readonly [Key in keyof Arguments]: Arguments[Key] } & { cycle: boolean };
type BooleanKey = { [Key in keyof Draft]: Draft[Key] extends boolean ? Key : never }[keyof Draft];
type NumberKey = "bars" | "seconds" | "tracks" | "seed" | "capacity" | "rounds" | "rangeAt";
/** Reads the option's value (next() takes the argument after it) into the draft. */
type OptionReader = (draft: Draft, next: () => string | undefined) => void;

function numberArgument(name: string, text: string | undefined, integer: boolean): number {
  const value = Number(text);
  if (text === undefined || !Number.isFinite(value) || value <= 0 || (integer && !Number.isInteger(value))) {
    throw new UsageError(`${name} needs a positive ${integer ? "integer" : "number"}`);
  }
  return value;
}

const flag = (key: BooleanKey, value = true): OptionReader => (draft) => void (draft[key] = value);
const positive = (name: string, key: NumberKey, integer: boolean): OptionReader => (draft, next) => void (draft[key] = numberArgument(name, next(), integer));
/** A value that is not the next option: --section, --take, --only. */
const named = (message: string, read: (draft: Draft, value: string) => void): OptionReader => (draft, next) => {
  const value = next();
  if (value === undefined || value.startsWith("--")) throw new UsageError(message);
  read(draft, value);
};
/** One of a closed list of words. */
const oneOf = <Value extends string>(values: readonly Value[], message: string, read: (draft: Draft, value: Value) => void): OptionReader => (draft, next) => {
  const text = next();
  const value = values.find((candidate) => candidate === text);
  if (value === undefined) throw new UsageError(message);
  read(draft, value);
};

/** Every option of the usage line, in its order there. */
export const OPTIONS: Readonly<Record<string, OptionReader>> = {
  "--bars": positive("--bars", "bars", true),
  "--seconds": positive("--seconds", "seconds", false),
  "--tracks": positive("--tracks", "tracks", true),
  "--out": (draft, next) => void (draft.out = next() ?? null),
  "--seed": positive("--seed", "seed", true),
  "--mode": oneOf(["loop", "song"] as const, "--mode is loop or song", (draft, mode) => void (draft.mode = mode)),
  "--section": named("--section needs a name or all", (draft, section) => void (draft.section = section)),
  "--rounds": positive("--rounds", "rounds", true),
  "--clock": oneOf(CLOCK_KINDS, "--clock is wall or cpu", (draft, clock) => void (draft.clock = clock)),
  "--no-samples": flag("samples", false),
  "--range": (draft, next) => {
    const match = /^(\d+)-(\d+)$/.exec(next() ?? "");
    const startBar = Number(match?.[1]);
    const endBar = Number(match?.[2]);
    if (match === null || startBar < 1 || endBar < startBar) throw new UsageError("--range is A-B, 1 ≤ A ≤ B");
    draft.range = { startBar, endBar, cycle: true };
  },
  "--range-at": positive("--range-at", "rangeAt", false),
  "--cycle": oneOf(["on", "off"] as const, "--cycle is on or off", (draft, cycle) => void (draft.cycle = cycle === "on")),
  "--scale": flag("scale"),
  "--costs": flag("costs"),
  "--levels": flag("levels"),
  "--gain": flag("gain"),
  "--capacity": positive("--capacity", "capacity", false),
  "--timbre": flag("timbre"),
  "--fail-closed": flag("failClosed"),
  "--only": named("--only needs instrument names, comma separated", (draft, names) => void (draft.only = new Set(names.split(",")))),
  "--templates": flag("templates"),
  "--take": named("--take needs a take.json file", (draft, take) => void (draft.take = take)),
  "--from-arm": flag("fromArm"),
  "--golden": flag("golden"),
  "--update": flag("update"),
};

const DEFAULTS: Draft = {
  file: null,
  bars: null,
  seconds: null,
  tracks: null,
  out: null,
  seed: null,
  mode: "loop",
  scale: false,
  golden: false,
  update: false,
  costs: false,
  levels: false,
  gain: false,
  capacity: null,
  section: null,
  rounds: 7,
  clock: "wall",
  samples: true,
  range: null,
  rangeAt: null,
  cycle: true,
  timbre: false,
  failClosed: false,
  only: null,
  templates: false,
  take: null,
  fromArm: false,
};

export function parseArguments(argv: readonly string[]): Arguments {
  const draft: Draft = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    // Own keys only: an argument such as "toString" is a file, never an inherited reader.
    const read = argument !== undefined && Object.hasOwn(OPTIONS, argument) ? OPTIONS[argument] : undefined;
    if (read !== undefined) read(draft, () => argv[++index]);
    else if (argument === undefined || argument.startsWith("--")) throw new UsageError(`unknown option ${argument ?? ""}`);
    else draft.file = argument;
  }
  if (draft.bars !== null && draft.seconds !== null) throw new UsageError("use --bars or --seconds, not both");
  if (draft.fromArm && draft.take === null) throw new UsageError("--from-arm needs --take <file>");
  const { scale, golden, costs, levels, gain, timbre, templates, capacity, take, file } = draft;
  if (!scale && !golden && !costs && !levels && !gain && !timbre && !templates && capacity === null && take === null && file === null) throw new UsageError("missing <file.untzel>");
  const { cycle, range, ...rest } = draft;
  return { ...rest, range: range === null ? null : { ...range, cycle } };
}
