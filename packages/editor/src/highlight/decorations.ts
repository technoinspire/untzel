// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { RangeSetBuilder, StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import type { TextRange } from "../ports";

// Two decoration layers, each driven by an effect so the session stays the only source
// of truth: the sounding tokens and the changed-line flash. Diagnostics are lint marks
// (diagnostics-bridge.ts).

export const setSounding = StateEffect.define<readonly TextRange[]>();
export const flashLine = StateEffect.define<number | null>();

const soundingMark = Decoration.mark({ class: "u-sounding" });
const changedLine = Decoration.line({ class: "cm-untzel-changed" });

/** Clamps, sorts and merges ranges so RangeSetBuilder accepts them. */
export function normalizeRanges(ranges: readonly TextRange[], length: number): readonly TextRange[] {
  const clamped = ranges
    .map((range) => ({ from: clamp(range.from, length), to: clamp(range.to, length) }))
    .filter((range) => range.to > range.from)
    .sort((a, b) => a.from - b.from || a.to - b.to);
  const merged: TextRange[] = [];
  for (const range of clamped) {
    const last = merged[merged.length - 1];
    if (last !== undefined && range.from <= last.to) merged[merged.length - 1] = { from: last.from, to: Math.max(last.to, range.to) };
    else merged.push(range);
  }
  return merged;
}

function clamp(value: number, length: number): number {
  return Math.min(Math.max(0, Math.trunc(value)), length);
}

function markField(effect: typeof setSounding, mark: Decoration): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(value, transaction) {
      let next = value.map(transaction.changes);
      for (const entry of transaction.effects) {
        if (!entry.is(effect)) continue;
        const builder = new RangeSetBuilder<Decoration>();
        for (const range of normalizeRanges(entry.value, transaction.state.doc.length)) builder.add(range.from, range.to, mark);
        next = builder.finish();
      }
      return next;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}

const changedField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, transaction) {
    let next = value.map(transaction.changes);
    for (const entry of transaction.effects) {
      if (!entry.is(flashLine)) continue;
      next = entry.value === null ? Decoration.none : lineDecoration(transaction.state, entry.value);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function lineDecoration(state: EditorState, lineNumber: number): DecorationSet {
  if (lineNumber < 1 || lineNumber > state.doc.lines) return Decoration.none;
  const line = state.doc.line(lineNumber);
  return Decoration.set([changedLine.range(line.from)]);
}

export function untzelDecorations(): Extension {
  return [markField(setSounding, soundingMark), changedField];
}
