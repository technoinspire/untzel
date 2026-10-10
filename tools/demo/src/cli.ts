// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm demo plan <template | demo name | file.untzel | file.demo.json>
//   prints the demo's timeline (bar:beat, clock, gesture, control) and its total length.
//   A template is named by its id ("melodic-techno/midnight-bloom") or its file name.
// pnpm demo plan --all
//   plans every template of apps/web/src/templates/ and checks each capture runs 1:00 to 3:00
//   and its Story cut, on a layer start, lasts 1:00 at most.
// pnpm demo record <demo> --format story|video|4k [--keep-frames]
//   records the demo through the app's interface into .cache/demo/ (record/record-command.ts).
// Exit codes: 0 plan printed (every plan in range) or video recorded, 1 the replay does not
// give the template's program or a gate failed, 2 bad input or a missing tool.
import { basename } from "node:path";
import { simRegistry } from "@untzel/sim/registry";
import { readTemplateTree, templateFiles } from "@untzel/sim/template-tree";
import { buildDemo } from "./demo-build";
import { DEMOS, InputError, resolveDemo } from "./demo-source";
import { formatClock, formatPlan } from "./plan-report";
import { captureSeconds, isCaptureInRange, MAX_CAPTURE_SECONDS, MAX_STORY_SECONDS, MIN_CAPTURE_SECONDS, plannedStory } from "./record/capture-length";
import { parseRecordArguments, runRecord } from "./record/record-command";

export interface CliContext {
  readonly repo: string;
  readonly write: (text: string) => void;
}

function plan(argument: string, context: CliContext): number {
  const resolved = resolveDemo(context.repo, argument);
  const { registry } = simRegistry();
  const built = buildDemo(resolved, registry);
  context.write(
    formatPlan({
      template: resolved.templateName,
      demoFile: resolved.demoPath === null ? null : `${DEMOS}/${basename(resolved.demoPath)}`,
      title: resolved.demo?.title ?? null,
      timeline: built.timeline,
      isSameProgram: built.isSameProgram,
      registry,
    }),
  );
  return built.isSameProgram ? 0 : 1;
}

/** Every template that has a song to build: a template without a track has nothing to show. */
function planAll(context: CliContext): number {
  const { registry } = simRegistry();
  let failed = 0;
  for (const file of templateFiles(readTemplateTree(context.repo))) {
    const resolved = resolveDemo(context.repo, file.id);
    const built = buildDemo(resolved, registry);
    const demoFile = resolved.demoPath === null ? "default pacing" : `${DEMOS}/${basename(resolved.demoPath)}`;
    if (built.program.tracks.length === 0) {
      context.write(`skip  ${file.id.padEnd(32)} no track: nothing to build\n`);
      continue;
    }
    const seconds = captureSeconds(built.timeline);
    const story = plannedStory(built.timeline);
    const why = [
      built.isSameProgram ? null : "DIFFERENT program",
      isCaptureInRange(seconds) ? null : `outside ${formatClock(MIN_CAPTURE_SECONDS)}–${formatClock(MAX_CAPTURE_SECONDS)}`,
      story.seconds <= MAX_STORY_SECONDS ? null : `Story over ${formatClock(MAX_STORY_SECONDS)}`,
      story.fromLayer === null ? "Story cut inside a layer" : null,
    ].filter((reason) => reason !== null);
    if (why.length > 0) failed += 1;
    const featured = `${built.featured.length} by hand`;
    const cut = `Story ${formatClock(story.seconds)} from ${story.fromLayer ?? "inside a layer"}`;
    context.write(`${why.length === 0 ? "ok  " : "FAIL"}  ${file.id.padEnd(32)} ${formatClock(seconds).padStart(6)} capture · ${featured} · ${cut} · ${demoFile}${why.map((reason) => ` · ${reason}`).join("")}\n`);
  }
  context.write(failed === 0 ? "every template plans to a 1:00–3:00 capture and a Story of 1:00 at most\n" : `${failed} template(s) out of range\n`);
  return failed === 0 ? 0 : 1;
}

const USAGE = [
  "usage: pnpm demo plan <template | demo name | file.untzel | file.demo.json>",
  "       pnpm demo plan --all",
  "       pnpm demo record <demo> --format story|video|4k [--keep-frames]",
  "",
].join("\n");

export async function main(argv: readonly string[], context: CliContext): Promise<number> {
  const [command, argument] = argv;
  try {
    if (command === "plan" && argument === "--all") return planAll(context);
    if (command === "plan" && argument !== undefined) return plan(argument, context);
    if (command === "record") {
      const parsed = parseRecordArguments(argv.slice(1));
      if (typeof parsed === "string") throw new InputError(parsed);
      return await runRecord(parsed, context);
    }
    context.write(USAGE);
    return 2;
  } catch (error: unknown) {
    if (!(error instanceof InputError) && !(error instanceof SyntaxError)) throw error;
    context.write(`demo: ${error.message}\n`);
    return 2;
  }
}
