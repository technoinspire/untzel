// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  buildArrangement,
  type Arrangement,
  type Pattern,
  type PatternContext,
  type PatternSpec,
  type Program,
} from "@untzel/core";

/** compilePattern from @untzel/core; injectable so tests can hand-build patterns. */
export type PatternCompiler = (spec: PatternSpec, context: PatternContext) => Pattern;

/** A Program with everything the scheduler needs per tick computed once. */
export interface CompiledProgram {
  readonly program: Program;
  /** One per track, in track order. */
  readonly patterns: readonly Pattern[];
  readonly arrangement: Arrangement | null;
  readonly sectionMembers: ReadonlyMap<string, ReadonlySet<string>>;
}

export function compileProgram(program: Program, compile: PatternCompiler): CompiledProgram {
  const patterns = program.tracks.map((track) =>
    compile(track.pattern, {
      trackName: track.name,
      sourceHash: program.sourceHash,
      key: program.key,
      free: track.free,
      transpose: track.transpose,
      swing: track.swing ?? program.swing,
      shift: track.shift,
      velocity: track.velocity,
      legato: track.legato,
      voicing: track.voicing,
      inversion: track.inversion,
      arp: track.arp,
    }),
  );
  const sectionMembers = new Map(
    program.sections.map((section) => [section.name, new Set(section.tracks)]),
  );
  return { program, patterns, arrangement: buildArrangement(program), sectionMembers };
}
