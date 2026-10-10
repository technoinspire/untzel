// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { StepPitch } from "@untzel/core";
import { button, element, setAttributes, setPressed, setText } from "../dom";
import { icon } from "../icons";
import type { AuditionSound } from "@untzel/skin-contract";
import { editingLabel } from "../../behavior/text/lengths";
import type { TrackView } from "@untzel/presentation/view-model";
import { revealInScroller } from "../../behavior/focus/reveal";
import { createSpokenText, type SpokenText } from "../../behavior/feedback/spoken-text";
import { strings } from "../../copy/copy";
import { soundOfPitch } from "./audition-touch";
import { createChordChips } from "./chord-chips";
import {
  chordRootOf,
  midiOfPitch,
  noteNameOf,
  octaveShifted,
  pickOutcome,
  pitchLabel,
  shiftWindow,
  startingMidi,
  stepPitchOf,
  stepStateLabel,
  windowStartFor,
} from "./note-picker-model";
import { createPianoKeys } from "./piano-keys";

// The note picker: opens from a step of a melodic track. Two
// octaves of keys with octave − and +, every key the step plays pressed (the chord's
// root marked), Scale lock, chord qualities for chord instruments, Note, Hold and Rest.
// Every touch sounds through the audition intent without touching the text; Choose, or
// a second tap on the same key, writes it. Arrow keys move between keys, Enter picks,
// Esc closes. What it shows comes from note-picker-model.ts. The step state and the scale
// warning are said through the shell's polite region (`announce`) when they change.

const STEP_STATES = ["note", "hold", "rest"] as const;
const STATE_LABELS = { note: strings.pitchNote, hold: strings.pitchHold, rest: strings.pitchRest } as const;

export interface NotePickerSubject {
  readonly track: TrackView;
  readonly bar: number;
  readonly step: number;
  readonly scaleLabel: string;
  /** Pitch classes of the key, tonic first. */
  readonly scale: readonly number[];
}

export interface NotePickerCallbacks {
  readonly onChoose: (pitch: StepPitch) => void;
  readonly onAudition: (sound: AuditionSound) => void;
  readonly onScaleLock: (isLocked: boolean) => void;
  readonly onClose: () => void;
  /** The shell's polite region. */
  readonly announce: (message: string) => void;
}

export interface NotePicker {
  readonly root: HTMLElement;
  /** Opens on a step, showing its note (or the last note before a rest or hold). */
  open(subject: NotePickerSubject): void;
  update(subject: NotePickerSubject): void;
  close(): void;
}

// Over 40 lines: one picker opened, drawn and closed; its keys and chips are their own views.
export function createNotePicker(callbacks: NotePickerCallbacks): NotePicker {
  let subject: NotePickerSubject | null = null;
  let start = 0;
  let pending: StepPitch | null = null;
  /** While opening, the lines shown are taken as heard: opening is not a change to say. */
  let isOpening = false;
  const spokenHolds = createSpokenText(callbacks.announce);
  const spokenWarning = createSpokenText(callbacks.announce);
  const speak = (line: SpokenText, text: string): void => (isOpening ? line.settle(text) : line.say(text));
  const title = element("p", { className: "ui-picker__title" });
  const holds = element("p", { className: "ui-picker__holds" });
  const close = button("ui-round ui-round--raised ui-picker__close", strings.close, () => callbacks.onClose(), [icon("close")]);
  const stateButtons = STEP_STATES.map((kind) => button("ui-segmented__option", STATE_LABELS[kind], () => onState(kind)));
  const states = element("div", { className: "ui-segmented ui-picker__states", attributes: { role: "group", "aria-label": strings.stepIs } }, stateButtons);
  const keys = createPianoKeys((midi) => onKey(midi), (delta) => moveWindow(delta), (warningText) => {
    setText(warning, warningText);
    speak(spokenWarning, warningText);
  });
  const { lower, higher } = keys;
  const lock = button("ui-switch ui-picker__lock", strings.scaleLock, () => {
    if (subject !== null) callbacks.onScaleLock(!subject.track.isScaleLocked);
  }, [element("span", { className: "ui-switch__track", attributes: { "aria-hidden": "true" } }), element("span", { text: strings.scaleLock })]);
  lock.setAttribute("role", "switch");
  lock.removeAttribute("aria-label");
  const warning = element("p", { className: "ui-picker__warning" });
  const chips = createChordChips((pitch) => pick(pitch));
  const choose = button("ui-pill ui-pill--primary ui-picker__choose", strings.choose, () => commit());
  const root = element("section", { className: "ui-picker", attributes: { hidden: true } }, [
    element("div", { className: "ui-picker__head" }, [element("div", {}, [title, holds]), close]),
    states,
    element("div", { className: "ui-picker__octaves" }, [lower, keys.span, higher, lock]),
    keys.root,
    warning,
    chips.root,
    choose,
  ]);

  const current = (): StepPitch => {
    const step = subject?.track.patternBars[subject.bar]?.[subject.step];
    return step === undefined ? { kind: "rest" } : stepPitchOf(step);
  };
  const shown = (): StepPitch => pending ?? current();
  const isChord = (): boolean => subject?.track.kind === "chord";
  const audition = (pitch: StepPitch | null): void => {
    const sound = soundOfPitch(pitch);
    if (sound !== null) callbacks.onAudition(sound);
  };

  const commit = (): void => {
    const pitch = shown();
    if (pitch.kind === "note" || pitch.kind === "chord") callbacks.onChoose(pitch);
    pending = null;
  };

  const pick = (pitch: StepPitch): void => {
    const outcome = pickOutcome(pending, pitch);
    pending = pitch;
    if (outcome === "commit") {
      commit();
      return;
    }
    audition(pitch);
    render();
  };

  const onKey = (midi: number): void => {
    const chord = shown();
    if (isChord()) pick({ kind: "chord", root: chordRootOf(midi), quality: chord.kind === "chord" ? chord.quality : "major" });
    else pick({ kind: "note", note: noteNameOf(midi) });
  };

  function onState(kind: (typeof STEP_STATES)[number]): void {
    if (kind !== "note") {
      pending = null;
      callbacks.onChoose({ kind });
      return;
    }
    onKey(midiOfPitch(shown()) ?? start);
  }

  /** Octave − and + move the window and, for a note, the note with it, which sounds. */
  function moveWindow(delta: -1 | 1): void {
    if (subject === null) return;
    const next = shiftWindow(start, delta, subject.track.pitchRange);
    if (next === null) return;
    start = next;
    const moved = octaveShifted(shown(), delta);
    if (moved !== null) {
      pending = moved;
      audition(moved);
    }
    render();
  }

  function render(): void {
    if (subject === null) return;
    const sounding = current();
    setText(title, `${editingLabel(subject.bar, subject.track.bars)} · step ${subject.step + 1}`);
    const holdsText = stepStateLabel(sounding);
    setText(holds, holdsText);
    speak(spokenHolds, holdsText);
    stateButtons.forEach((node, index) => setPressed(node, STEP_STATES[index] === (sounding.kind === "chord" ? "note" : sounding.kind)));
    setAttributes(lower, { "aria-disabled": shiftWindow(start, -1, subject.track.pitchRange) === null ? "true" : null });
    setAttributes(higher, { "aria-disabled": shiftWindow(start, 1, subject.track.pitchRange) === null ? "true" : null });
    lock.setAttribute("aria-checked", String(subject.track.isScaleLocked));
    keys.render(start, subject.scale, subject.scaleLabel, subject.track.isScaleLocked && !isChord(), sounding, pending);
    chips.render(isChord(), shown());
    const pitch = shown();
    const writable = pitch.kind === "note" || pitch.kind === "chord";
    setText(choose, writable ? `${strings.choose} ${pitchLabel(pitch)}` : strings.choose);
    setAttributes(choose, { "aria-disabled": writable ? null : "true" });
  }

  // Esc closes the picker only, not the sheet around it.
  root.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    callbacks.onClose();
  });

  return {
    root,
    open(next) {
      subject = next;
      pending = null;
      const steps = next.track.patternBars[next.bar] ?? [];
      const midi = startingMidi(steps, next.step, next.scale[0] ?? 0);
      start = windowStartFor(midi, next.track.pitchRange);
      // A rest or hold opens on the last note used, ready for Choose (nothing written yet).
      const kind = current().kind;
      if (kind === "rest" || kind === "hold") {
        pending = isChord() ? { kind: "chord", root: chordRootOf(midi), quality: "major" } : { kind: "note", note: noteNameOf(midi) };
      }
      root.hidden = false;
      isOpening = true;
      render();
      isOpening = false;
      // Whole above the sheet's footer, Choose included, at 390 px too.
      revealInScroller(root, ".ui-sheet__body");
    },
    update(next) {
      if (root.hidden) return;
      subject = next;
      render();
    },
    close() {
      root.hidden = true;
      subject = null;
      pending = null;
    },
  };
}
