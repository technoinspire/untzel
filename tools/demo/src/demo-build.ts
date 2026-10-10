// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A demo ready to plan or record: the template's text and program, its script fitted to
// the video, the script's replay checked against the template, and the timeline with the
// demo's pacing.
import { existsSync, readFileSync } from "node:fs";
import type { InstrumentRegistry, Program } from "@untzel/core";
import { analyze } from "@untzel/language";
import { demoActions, type DemoScript } from "./actions";
import { planDemo } from "./demo-plan";
import { InputError, type ResolvedDemo } from "./demo-source";
import { charsPerSecondOf, type Timeline } from "./pacing";
import { isSameProgram } from "./script/program-equality";
import { replayActions } from "./script/replay";

export interface BuiltDemo {
  readonly source: string;
  readonly program: Program;
  readonly script: DemoScript;
  readonly timeline: Timeline;
  /** The tracks built by hand, in producer order; the others are typed in the Code panel. */
  readonly featured: readonly string[];
  /** The script, replayed from an empty text, gives the template's program. */
  readonly isSameProgram: boolean;
  /** Code typing speed of the demo's pacing, key by key and in bursts. */
  readonly typingCharsPerSecond: number;
  readonly burstCharsPerSecond: number;
}

export function buildDemo(resolved: ResolvedDemo, registry: InstrumentRegistry): BuiltDemo {
  if (!existsSync(resolved.templatePath)) throw new InputError(`no template at ${resolved.templatePath}`);
  const source = readFileSync(resolved.templatePath, "utf8");
  const template = analyze(source, registry);
  if (!template.ok) throw new InputError(`${resolved.templatePath} does not play`);
  const featured = resolved.demo?.featured ?? null;
  const unknown = (featured ?? []).filter((name) => !template.program.tracks.some((track) => track.name === name));
  if (unknown.length > 0) throw new InputError(`${resolved.demoPath ?? "the demo file"}: featured tracks not in the template: ${unknown.join(", ")}`);
  const pacing = resolved.demo?.pacing ?? {};
  const plan = planDemo(source, registry, { featured, pacing });
  if (plan === null) throw new InputError(`${resolved.templatePath} does not play`);
  const replayed = replayActions("", demoActions(plan.script), registry);
  const final = replayed.ok ? analyze(replayed.source, registry) : null;
  const same = final?.ok === true && isSameProgram(final.program, template.program);
  return {
    source,
    program: template.program,
    script: plan.script,
    timeline: plan.timeline,
    featured: plan.featured,
    isSameProgram: same,
    typingCharsPerSecond: charsPerSecondOf("keys", pacing),
    burstCharsPerSecond: charsPerSecondOf("bursts", pacing),
  };
}
