// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The plan played through the interface: each action at its frame, by its gesture, and the
// session's text checked against the script's own replay right after, so a gesture that
// writes something else stops the recording at that action instead of at the end.
import type { InstrumentRegistry } from "@untzel/core";
import type { DemoAction } from "../actions";
import type { Timeline } from "../pacing";
import { replayAction } from "../script/replay";
import type { GestureContext, GesturePage } from "./gesture-page";
import { actionFrames } from "./gesture-schedule";
import { perform } from "./gestures";

export interface PlannedAction {
  readonly index: number;
  readonly action: DemoAction;
  /** The frame the plan starts it on. */
  readonly frame: number;
  /** The text right before it, and right after, as the script's replay has them. */
  readonly before: string;
  readonly after: string;
}

/** Every action of the timeline with its frame and its texts. Pure. */
export function plannedActions(timeline: Timeline, registry: InstrumentRegistry): PlannedAction[] {
  const frames = actionFrames(timeline);
  let source = "";
  return timeline.actions.map(({ action }, index) => {
    const result = replayAction(source, action, registry);
    if (!result.ok) throw new Error(`action ${index} (${action.kind}) does not replay: ${result.reason}`);
    const planned = { index, action, frame: frames[index] ?? 0, before: source, after: result.source };
    source = result.source;
    return planned;
  });
}

/** The frames a page's clock is moved by, and the text it holds. */
export interface PlanStage {
  readonly frame: number;
  advance(frames?: number): Promise<void>;
  advanceTo(frame: number): Promise<void>;
  sessionText(): Promise<string>;
}

export interface PerformedAction {
  readonly index: number;
  readonly kind: DemoAction["kind"];
  readonly plannedFrame: number;
  readonly startFrame: number;
  readonly endFrame: number;
}

export class GestureDiverged extends Error {
  readonly index: number;
  constructor(index: number, action: DemoAction, detail: string) {
    super(`action ${index} (${action.kind}) wrote another text: ${detail}`);
    this.index = index;
  }
}

/** How long a written change may take to reach the session (the Code panel's pause is 300 ms). */
const TEXT_WAIT_FRAMES = 30;

/** The first line where two texts differ, for the message. */
function firstDifference(expected: string, actual: string): string {
  const want = expected.split("\n");
  const got = actual.split("\n");
  const line = want.findIndex((text, index) => text !== got[index]);
  const at = line < 0 ? want.length : line;
  return `line ${at + 1}: expected ${JSON.stringify(want[at] ?? "")}, got ${JSON.stringify(got[at] ?? "")}`;
}

async function settled(stage: PlanStage, planned: PlannedAction): Promise<void> {
  for (let wait = 0; ; wait += 1) {
    const text = await stage.sessionText();
    if (text === planned.after) return;
    if (wait >= TEXT_WAIT_FRAMES) throw new GestureDiverged(planned.index, planned.action, firstDifference(planned.after, text));
    await stage.advance();
  }
}

/** Plays `plan` on the page; returns when the last action's text is in. */
export async function performPlan(
  stage: PlanStage,
  page: GesturePage,
  plan: readonly PlannedAction[],
  context: Omit<GestureContext, "source">,
  onAction: (performed: PerformedAction) => void = () => undefined,
): Promise<readonly PerformedAction[]> {
  const performed: PerformedAction[] = [];
  for (const planned of plan) {
    await stage.advanceTo(planned.frame);
    const startFrame = stage.frame;
    await perform(page, planned.action, { ...context, source: planned.before });
    await settled(stage, planned);
    const done = { index: planned.index, kind: planned.action.kind, plannedFrame: planned.frame, startFrame, endFrame: stage.frame };
    performed.push(done);
    onAction(done);
  }
  return performed;
}
