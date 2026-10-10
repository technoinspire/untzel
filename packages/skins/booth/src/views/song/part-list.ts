// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element } from "../dom";
import type { PlayRangeValue, SongView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";
import { partRangeStates } from "../range/part-range-model";
import { createPartRow, updatePartRow, type PartRangeIntents, type PartRowNodes } from "./part-row";
import { partRowStates } from "./part-row-state";
import { rovingIndex } from "../primitives/roving-keys";
// The parts of the song in playing order, one
// row each; the playing part outlined in flare with its bar filling as it plays. A tap
// opens the part's editor. Up and down move between the parts with one tab stop; Enter
// or Space opens one. Beside each row: To here (outside a range), the bracket
// button that starts the range at the part, and the part's Play, which repeats it alone.
// The rows' texts come from part-row-state.ts and part-range-model.ts.


export interface PartList {
  readonly root: HTMLOListElement;
  update(song: SongView, openPart: number | null, range: PlayRangeValue | null): void;
  /**
   * The row showing `part` now, when `opener` is one of the rows; else null. Rows are
   * reused by index, so after a Move the part that opened the editor sits in another row.
   */
  rowFor(opener: HTMLElement, part: number): HTMLElement | null;
}

/** `onRename`: the row's pencil opens the part editor with its name in edit. */
export function createPartList(onOpen: (part: number) => void, onRename: (part: number) => void, intents: PartRangeIntents): PartList {
  const root = element("ol", { className: "ui-song__list", attributes: { "aria-label": strings.parts } });
  const rows: PartRowNodes[] = [];
  root.addEventListener("keydown", (event) => {
    const index = rovingIndex(rows.findIndex((nodes) => nodes.row === event.target), rows.length, event.key, true);
    if (index === null) return;
    event.preventDefault();
    const next = rows[index]?.row;
    if (next === undefined) return;
    for (const nodes of rows) nodes.row.tabIndex = nodes.row === next ? 0 : -1;
    next.focus();
  });
  return {
    root,
    update(song, openPart, range) {
      const states = partRowStates(song, openPart);
      const ranges = partRangeStates(song.parts, range);
      while (rows.length < states.length) rows.push(createPartRow(root, rows.length, onOpen, onRename, intents));
      while (rows.length > states.length) {
        rows.pop();
        root.lastElementChild?.remove();
      }
      const hasFocus = root.contains(document.activeElement);
      const focusable = openPart ?? song.currentPart ?? 0;
      states.forEach((state, index) => {
        const nodes = rows[index];
        const inRange = ranges[index];
        if (nodes === undefined || inRange === undefined) return;
        updatePartRow(nodes, state, inRange, hasFocus ? null : index === focusable ? 0 : -1);
      });
    },
    rowFor(opener, part) {
      return rows.some((nodes) => nodes.row === opener) ? (rows[part]?.row ?? null) : null;
    },
  };
}
