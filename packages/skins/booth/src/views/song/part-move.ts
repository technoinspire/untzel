// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setAttributes } from "../dom";
import type { SongIntents } from "@untzel/skin-contract";
import { strings } from "../../copy/copy";
import { PART_EDITOR_ID } from "./part-row";

/** Move, and the Move up and Move down row it opens; the part editor follows the part it moved. */
export function createPartMove(intents: Pick<SongIntents, "movePart">, part: () => number | null, onMoved: (part: number) => void): {
  readonly move: HTMLButtonElement;
  readonly row: HTMLElement;
  update(canMoveUp: boolean, canMoveDown: boolean): void;
} {
  const inert = (node: HTMLElement): boolean => node.getAttribute("aria-disabled") === "true";
  const moveRowId = `${PART_EDITOR_ID}-move`;
  const move = button("ui-pill ui-pill--raised", strings.move, () => {
    moveRow.hidden = !moveRow.hidden;
    move.setAttribute("aria-expanded", String(!moveRow.hidden));
  });
  setAttributes(move, { "aria-expanded": "false", "aria-controls": moveRowId });
  const moveBy = (delta: -1 | 1): void => {
    const shown = part();
    if (shown === null) return;
    intents.movePart(shown, delta);
    onMoved(shown + delta);
  };
  const up = button("ui-pill ui-pill--raised", strings.moveUp, () => {
    if (!inert(up)) moveBy(-1);
  });
  const down = button("ui-pill ui-pill--raised", strings.moveDown, () => {
    if (!inert(down)) moveBy(1);
  });
  const moveRow = element("div", { className: "ui-part__move", attributes: { id: moveRowId, hidden: true } }, [up, down]);
  return {
    move,
    row: moveRow,
    update(canMoveUp, canMoveDown) {
      setAttributes(up, { "aria-disabled": canMoveUp ? null : "true" });
      setAttributes(down, { "aria-disabled": canMoveDown ? null : "true" });
    },
  };
}
