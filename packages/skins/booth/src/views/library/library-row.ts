// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setPressed } from "../dom";
import { icon } from "../icons";
import { ROW_ATTRIBUTES, cellAttributes, nameCellId } from "../../behavior/library/library-grid";
import { previewLabel, soundsLabel } from "../../behavior/library/library-labels";
import { rowActionLabel, rowRole, rowUsage } from "../../behavior/library/library-mode";
import type { AuditionView, LibraryEntryView } from "@untzel/presentation/view-model";
import { createLibraryAuditionPanel } from "./library-audition-panel";
import type { LibraryRowActions } from "./library-row-actions";

export type { LibraryRowActions } from "./library-row-actions";


function cell(className: string, children: readonly Node[], id?: string): HTMLElement {
  return element("div", { className, attributes: cellAttributes(id) }, children);
}

/** The action cell: + to add, the swap icon to use, a ✓ ring for the sound playing now (nothing to do). */
function actionCell(entry: LibraryEntryView, chosen: string | null, actions: LibraryRowActions): HTMLElement {
  const role = rowRole(actions.mode, entry);
  const label = rowActionLabel(actions.mode, entry);
  if (role === "current") {
    return cell("ui-library__cell", [element("span", { className: "ui-library__current", attributes: { role: "img", "aria-label": label } }, [icon("check")])]);
  }
  const action = button("ui-library__add", label, () => actions.choose(entry.instrument, chosen, null), [icon(role === "add" ? "plus" : "swap")]);
  return cell("ui-library__cell", [action]);
}

/**
 * One instrument of the library, a row of the grid: the name cell
 * (name, use in the song, description and sounds), a preview cell and an action cell.
 * While it plays, a fourth cell holds the audition panel. Each button sits in its own
 * cell, so no interactive control is nested in another.
 */
export function createLibraryRow(entry: LibraryEntryView, audition: AuditionView | null, actions: LibraryRowActions): HTMLLIElement {
  const playing = audition !== null && audition.instrument === entry.instrument ? audition : null;
  const chosen = playing?.sound ?? null;
  const isCurrent = rowRole(actions.mode, entry) === "current";
  const preview = button("ui-library__preview", previewLabel(entry.instrument, playing !== null), () => {
    if (playing === null) actions.preview(entry.instrument, null, null);
    else actions.stop();
  }, [icon(playing === null ? "play" : "stop")]);
  setPressed(preview, playing !== null);
  const head = element("div", { className: "ui-library__row-head" }, [
    cell("ui-library__text", [
      element("p", { className: "ui-library__name" }, [
        element("span", { text: entry.instrument }),
        ...(entry.model === null ? [] : [element("span", { className: "ui-library__model", text: entry.model })]),
        element("span", { className: "ui-library__use", text: rowUsage(actions.mode, entry) }),
      ]),
      element("p", { className: "ui-library__detail" }, [
        element("span", { className: "ui-library__description", text: entry.description }),
        element("span", { className: "ui-library__count", text: ` · ${soundsLabel(entry.sounds.length)}` }),
      ]),
    ], nameCellId(entry.instrument)),
    // The sound playing now has no preview: it is what the text plays.
    cell("ui-library__cell", isCurrent ? [] : [preview]),
    actionCell(entry, chosen, actions),
  ]);
  const row = element("li", { className: "ui-library__row", attributes: { ...ROW_ATTRIBUTES, "aria-selected": "false" } }, [head]);
  row.dataset["playing"] = String(playing !== null);
  if (playing !== null) row.append(createLibraryAuditionPanel(entry, playing, actions.mode, actions));
  return row;
}
