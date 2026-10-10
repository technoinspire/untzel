// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentRegistry } from "@untzel/core";
import type { DemoAction } from "./actions";
import { controlFor, type DemoControl } from "./script/controls";
import { BEATS_PER_BAR, barAndBeat, type Timeline } from "./pacing";
import { parameterGesture, writtenModifiers } from "./record/gestures/track/parameter-gesture";
import { replayAction } from "./script/replay";

// The text `pnpm demo plan` prints: every gesture at its bar and beat, the control that
// performs it, the total duration and what still has to be typed in Code.

export interface PlanReport {
  readonly template: string;
  readonly demoFile: string | null;
  readonly title: string | null;
  readonly timeline: Timeline;
  /** The replayed text analyzes to the same program as the template. */
  readonly isSameProgram: boolean;
  readonly registry: InstrumentRegistry;
}

export function describeAction(action: DemoAction): string {
  switch (action.kind) {
    case "addTrack":
      return `add track ${action.track} (${action.instrument}${action.preset === null ? "" : `, preset ${action.preset}`})`;
    case "renameTrack":
      return `rename ${action.track} to ${action.newName}`;
    case "setStepCount":
      return `${action.track}: ${action.count} steps per bar`;
    case "setTrackBars":
      return `${action.track}: ${action.bars} bars`;
    case "toggleStep":
      return `${action.track}: tap bar ${action.bar + 1} step ${action.step + 1}`;
    case "setStepNote":
      return `${action.track}: bar ${action.bar + 1} step ${action.step + 1} = ${action.note}`;
    case "setParameter":
      return `${action.track}: ${action.parameter} ${action.value}`;
    case "setMute":
      return `${action.track}: ${action.muted ? "mute" : "unmute"}`;
    case "setLoopBars":
      return `length ${action.bars} bars`;
    case "addSectionMember":
      return `section ${action.section} + ${action.track}`;
    case "typeCode":
      return `type "${action.text.trim()}"`;
    case "togglePlay":
      return "play";
    case "setMode":
      return `${action.mode} mode`;
    case "drop":
      return "drop";
  }
}

function describeControl(control: DemoControl): string {
  return control.kind === "intent" ? control.intent : `Code: ${control.why}`;
}

export function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(1).padStart(4, "0")}`;
}

function formatPosition(beat: number): string {
  const position = barAndBeat(beat);
  return `${String(position.bar).padStart(3)}:${position.beat.toFixed(2)}`;
}

/**
 * A fader the session rounds may not reach the template's value at any position: the
 * recorder then types it at the end of the line (parameter-gesture.ts), and the plan says so.
 */
function faderControl(action: Extract<DemoAction, { kind: "setParameter" }>, source: string, instrument: string | undefined, registry: InstrumentRegistry): DemoControl | null {
  const manifest = instrument === undefined ? undefined : registry.get(instrument);
  if (manifest === undefined) return null;
  const gesture = parameterGesture(manifest, action.parameter, action.value, writtenModifiers(action.track, source, registry));
  return gesture.kind === "code" ? { kind: "code", why: `no fader position writes this "${action.parameter}"` } : null;
}

/** The control of every timed action, following adds and renames for parameter lookups. */
function controlsOf(report: PlanReport): DemoControl[] {
  const instruments = new Map<string, string>();
  let source = "";
  return report.timeline.actions.map(({ action }) => {
    if (action.kind === "addTrack") instruments.set(action.track, action.instrument);
    if (action.kind === "renameTrack") {
      const instrument = instruments.get(action.track);
      if (instrument !== undefined) instruments.set(action.newName, instrument);
    }
    const control = controlFor(action, (track) => instruments.get(track), report.registry);
    const fader = action.kind === "setParameter" && control.kind === "intent" ? faderControl(action, source, instruments.get(action.track), report.registry) : null;
    const replayed = replayAction(source, action, report.registry);
    if (replayed.ok) source = replayed.source;
    return fader ?? control;
  });
}

function countLine(label: string, reasons: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const reason of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  const listed = [...counts].map(([reason, count]) => `${reason} ×${count}`).join(", ");
  return `${label}: ${listed === "" ? "none" : listed}`;
}

/** Typed because no edit function exists, and typed because no intent exists yet. */
function gapLines(report: PlanReport, controls: readonly DemoControl[]): string[] {
  const actions = report.timeline.actions.map((timed) => timed.action);
  const typed = actions.flatMap((action) => (action.kind === "typeCode" ? [action.reason] : []));
  const editGaps = typed.filter((reason) => reason !== "band");
  const bandLines = typed.length - editGaps.length;
  const intentGaps = controls.flatMap((control, index) =>
    control.kind === "code" && actions[index]?.kind !== "typeCode" ? [control.why] : [],
  );
  return [
    `typed in Code to keep the video short: ${bandLines} band line${bandLines === 1 ? "" : "s"} (the tracks outside the featured layers)`,
    countLine("typed in Code, no edit function yet", editGaps),
    countLine("edit exists, no intent yet (typed in Code)", intentGaps),
  ];
}

function header(report: PlanReport): string[] {
  const title = report.title === null ? "" : ` · ${report.title}`;
  const roundTrip = report.isSameProgram
    ? "same program as the template (formatting may differ)"
    : "DIFFERENT program from the template";
  return [
    `demo plan · ${report.template}${title} · ${report.demoFile ?? "default pacing"}`,
    `tempo ${report.timeline.tempo} bpm · 4/4 · starts from an empty text`,
    `round trip: ${roundTrip}`,
  ];
}

/** One line per gesture: bar:beat, clock, what happens, which control does it. */
function actionLines(report: PlanReport, controls: readonly DemoControl[]): string[] {
  const { timeline } = report;
  const at = (beat: number): string => formatPosition(beat).trim();
  return timeline.layers.flatMap((layer, index) => [
    "",
    `layer ${layer.name} (${layer.role}) · starts ${at(layer.startBeat)} · enters ${at(layer.entersBeat)} · next ${at(layer.endBeat)}`,
    ...timeline.actions.flatMap((timed, position) => {
      const control = controls[position];
      if (timed.layer !== index || control === undefined) return [];
      const clock = formatClock((timed.startBeat * 60) / timeline.tempo).padStart(6);
      return [`  ${formatPosition(timed.startBeat)}  ${clock}  ${describeAction(timed.action).padEnd(40)}  ${describeControl(control)}`];
    }),
  ]);
}

export function formatPlan(report: PlanReport): string {
  const { timeline } = report;
  const controls = controlsOf(report);
  const bars = timeline.totalBeats / BEATS_PER_BAR;
  const lines = [
    ...header(report),
    ...actionLines(report, controls),
    "",
    `total: ${formatClock(timeline.totalSeconds)} (${bars} bars) · ${timeline.actions.length} actions`,
    ...gapLines(report, controls),
  ];
  return `${lines.join("\n")}\n`;
}
