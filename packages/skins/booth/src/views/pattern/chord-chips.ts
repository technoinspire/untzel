// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ChordQuality, StepPitch } from "@untzel/core";
import { button, element, setPressed } from "../dom";
import { strings } from "../../copy/copy";
import { qualityChips } from "./note-picker-model";

/** The chord the chips act on: the step's chord, or C with no quality pressed. */
export function chordChoice(pitch: StepPitch): { readonly root: string; readonly quality: ChordQuality | null } {
  return pitch.kind === "chord" ? { root: pitch.root, quality: pitch.quality } : { root: "C", quality: null };
}

/** The chord qualities of a chord instrument; a chip picks the chord on the same root. */
export function createChordChips(pick: (pitch: StepPitch) => void): { readonly root: HTMLElement; render(isChord: boolean, pitch: StepPitch): void } {
  const chips = element("div", { className: "ui-picker__chords", attributes: { role: "group", "aria-label": strings.chordQuality } });
  return {
    root: chips,
    render(isChord, pitch) {
      chips.hidden = !isChord;
      if (!isChord) return;
      const chord = chordChoice(pitch);
      const signature = `${chord.root}|${chord.quality ?? ""}`;
      if (chips.dataset["signature"] === signature) return;
      chips.dataset["signature"] = signature;
      chips.replaceChildren(...qualityChips(chord.root, chord.quality).map((chip) => {
        const node = button("ui-pill ui-pill--chip", chip.label, () => pick({ kind: "chord", root: chord.root, quality: chip.quality }));
        setPressed(node, chip.isPressed);
        return node;
      }));
    },
  };
}
