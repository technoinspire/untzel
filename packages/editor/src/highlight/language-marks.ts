// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { EditorState, Extension, Range } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { CodeOutline } from "../assist/code-outline";
import { outlineField } from "../assist/outline-field";

// The outline as classes: steps of a hits
// word, track names and section members in their track color, modifier groups that
// never break, the hanging indent of a track's continuation lines and the sections block.

/** Hanging indent classes exist from 4 to 32 columns (styles/language.css). */
export const MIN_HANG = 4;
export const MAX_HANG = 32;

/** "u-hang-14" for a pattern at column 14; null under 4 columns. */
export function hangClass(column: number): string | null {
  if (column < MIN_HANG) return null;
  return `u-hang-${Math.min(column, MAX_HANG)}`;
}

/** "u-block-sections" plus the first and last marks of its run. */
export function sectionLineClass(index: number, count: number): string {
  return ["u-block-sections", index === 0 ? "u-block-sections--first" : "", index === count - 1 ? "u-block-sections--last" : ""]
    .filter((name) => name !== "")
    .join(" ");
}

/** Null for an empty range: half-typed text gives the tree empty nodes, and CodeMirror refuses empty marks. */
function mark(className: string, from: number, to: number): Range<Decoration> | null {
  return to > from ? Decoration.mark({ class: className }).range(from, to) : null;
}

function line(state: EditorState, number: number, className: string): Range<Decoration> | null {
  return number >= 1 && number <= state.doc.lines ? Decoration.line({ class: className }).range(state.doc.line(number).from) : null;
}

export function outlineDecorations(state: EditorState, outline: CodeOutline): DecorationSet {
  const ranges: (Range<Decoration> | null)[] = [
    ...outline.steps.map((step) => mark(`u-${step.kind}`, step.from, step.to)),
    ...outline.tracks.map((track) => mark(`u-track-${track.color} u-track-name`, track.label.from, track.label.to)),
    ...outline.members.map((member) => mark(`u-track-${member.color} u-track-member`, member.from, member.to)),
    ...outline.sectionNames.map((name) => mark("u-section-name", name.from, name.to)),
    ...outline.groups.map((group) => mark("u-mod", group.from, group.to)),
    ...outline.tracks.map((track) => {
      const className = hangClass(track.hang);
      return className === null ? null : line(state, track.line, className);
    }),
    ...outline.sectionBlocks.flatMap((block) => block.map((number, index) => line(state, number, sectionLineClass(index, block.length)))),
  ];
  return Decoration.set(ranges.filter((range): range is Range<Decoration> => range !== null), true);
}

export function languageMarks(): Extension {
  return [outlineField, EditorView.decorations.compute([outlineField], (state) => outlineDecorations(state, state.field(outlineField)))];
}
