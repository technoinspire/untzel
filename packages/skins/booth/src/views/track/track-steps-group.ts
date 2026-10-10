// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setAttributes, setPressed } from "../dom";
import type { AuditionSound, BarIntents, TrackIntents } from "@untzel/skin-contract";
import type { TrackView, UntzelView } from "@untzel/presentation/view-model";
import { phrases, strings, text } from "../../copy/copy";
import { soundOfStepTap } from "../pattern/audition-touch";
import { createBarEditor } from "../bars/bar-editor";
import { audibleBars } from "../bars/bar-thumb-state";
import { createLengthChip } from "../song-settings/length-chip";
import { createNotePicker, type NotePickerSubject } from "../pattern/note-picker";
import { scalePitchClassesOf } from "./track-detail-model";

export const STEP_COUNTS = [8, 16, 32] as const;

/** Steps per bar of the bar in edit: its own length, or the pattern's first bar. */
export function stepCountShown(track: TrackView, bar: number): number {
  return (track.patternBars[bar] ?? track.steps).length;
}

export interface TrackStepsOptions {
  /** Opens the pattern length picker for the track shown (1 2 4 8 16). */
  readonly onLength: () => void;
  readonly initialStep?: number;
  /** The shell's polite region: the bar being edited and the note picker's lines. */
  readonly announce: (message: string) => void;
  /** Another bar is in edit: the transport's range ruler outlines it. */
  readonly onEditingBar: () => void;
}

export interface TrackStepsGroup {
  readonly nodes: readonly Node[];
  /** The Pattern chip, which the length picker returns focus to. */
  readonly length: HTMLButtonElement;
  editingBar(): number;
  /** Another track is shown: no step stays chosen. */
  leave(): void;
  update(track: TrackView, next: UntzelView, isDesktop: boolean, isLengthOpen: boolean): void;
}

/** The detail's steps: the length chip, steps per bar, the bar editor and the note picker of the chosen step. */
// Over 40 lines: one group built and drawn; the picker and the bar editor share the chosen step.
export function createTrackStepsGroup(
  intents: BarIntents & Pick<TrackIntents, "setStepCount" | "setStepPitch" | "setScaleLock" | "toggleStep">,
  shown: () => TrackView | null,
  audition: (sound: AuditionSound | null) => void,
  options: TrackStepsOptions,
): TrackStepsGroup {
  let view: UntzelView | null = null;
  /** The step the note picker edits (melodic tracks). */
  let selectedStep: number | null = options.initialStep ?? null;
  let isDesktop = false;
  const name = (): string => shown()?.name ?? "";
  const length = createLengthChip("ui-detail__length", options.onLength);
  const stepOptions = STEP_COUNTS.map((count) => {
    const node = button("ui-segmented__option", String(count), () => intents.setStepCount(name(), count));
    setAttributes(node, { "aria-label": text.stepsPerBarOf(count) });
    return node;
  });
  const steps = element("div", { className: "ui-segmented ui-detail__steps", attributes: { role: "group", "aria-label": text.stepsPerBar } }, stepOptions);

  const subject = (): NotePickerSubject | null => {
    const current = shown();
    if (current === null || view === null || selectedStep === null) return null;
    const scale = scalePitchClassesOf(view.scale.notes);
    return { track: current, bar: barEditor.editingBar, step: selectedStep, scaleLabel: view.scale.label, scale };
  };
  const closePicker = (): void => {
    picker.close();
    if (selectedStep !== null) barEditor.focusStep(selectedStep);
  };
  const picker = createNotePicker({
    onChoose: (pitch) => {
      const current = shown();
      if (current !== null && selectedStep !== null) intents.setStepPitch(current.name, barEditor.editingBar, selectedStep, pitch);
    },
    onAudition: (sound) => audition(sound),
    onScaleLock: (isLocked) => intents.setScaleLock(name(), isLocked),
    onClose: closePicker,
    announce: options.announce,
  });
  const barEditor = createBarEditor(intents, (bar, step) => {
    const current = shown();
    if (current === null) return;
    const cell = current.patternBars[bar]?.[step];
    // A tap sounds what the step plays; a drum step also turns on or off, a melodic
    // step is only chosen and opens the picker, so choosing never deletes a note.
    if (cell !== undefined) audition(soundOfStepTap(cell, current.kind));
    if (current.kind === "drum") {
      intents.toggleStep(current.name, bar, step);
      return;
    }
    selectedStep = step;
    const next = subject();
    if (next !== null) picker.open(next);
    if (view !== null) render(view);
  }, options.announce, options.onEditingBar);

  function render(next: UntzelView): void {
    const current = shown();
    if (current === null) return;
    const isMelodic = current.kind !== "drum";
    barEditor.update(current, isDesktop, isMelodic ? selectedStep : null, audibleBars(current.bars, next.transport));
    const count = stepCountShown(current, barEditor.editingBar);
    stepOptions.forEach((option, index) => setPressed(option, STEP_COUNTS[index] === count));
    const picked = subject();
    if (!isMelodic || picked === null) picker.close();
    else picker.update(picked);
    view = next;
  }

  return {
    nodes: [element("div", { className: "ui-detail__lengths" }, [length.root, steps]), barEditor.root, picker.root],
    length: length.root,
    editingBar: () => barEditor.editingBar,
    leave() {
      selectedStep = null;
      picker.close();
    },
    update(track, next, isDesktopLayout, isLengthOpen) {
      isDesktop = isDesktopLayout;
      view = next;
      length.update(phrases.patternChip(track.bars), phrases.lengthName(strings.patternLength, track.bars), isLengthOpen);
      render(next);
    },
  };
}
