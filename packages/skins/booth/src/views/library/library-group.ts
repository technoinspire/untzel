// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element } from "../dom";
import { ROW_ATTRIBUTES, cellAttributes } from "../../behavior/library/library-grid";
import { showAllLabel } from "../../behavior/library/library-labels";
import type { LibraryGroup } from "../../behavior/library/library-search";
import type { AuditionView } from "@untzel/presentation/view-model";
import { groupLabels } from "../../copy/copy";
import { createLibraryRow, type LibraryRowActions } from "./library-row";

/** A one-cell row of the grid: the group label or the Show all button. */
function wideRow(className: string, children: readonly Node[]): HTMLLIElement {
  return element("li", { className, attributes: ROW_ATTRIBUTES }, [element("div", { attributes: cellAttributes() }, children)]);
}

/**
 * The rows of one group: its label (left out while a search is written, when the
 * results line replaces it), its instruments and, when some are hidden, Show all.
 */
export function libraryGroupRows(group: LibraryGroup, audition: AuditionView | null, actions: LibraryRowActions, withLabel: boolean, showAll: () => void): Node[] {
  const rows: Node[] = group.entries.map((entry) => createLibraryRow(entry, audition, actions));
  if (withLabel) rows.unshift(wideRow("ui-library__label", [document.createTextNode(groupLabels[group.group])]));
  if (group.hidden > 0) {
    const more = button("ui-pill ui-library__more", showAllLabel(group.entries.length + group.hidden, group.group), showAll);
    rows.push(wideRow("ui-library__more-row", [more]));
  }
  return rows;
}
