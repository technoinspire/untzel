// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setPressed } from "../dom";
import { LIBRARY_CATEGORIES, type LibraryCategory } from "../../behavior/library/library-search";
import { groupLabels, text } from "../../copy/copy";


export interface LibraryCategories {
  readonly root: HTMLElement;
  /** `available`: the groups with an instrument listed; the others leave (Change sound). */
  update(selected: LibraryCategory, available: ReadonlySet<LibraryCategory>): void;
}

/** A chip is pressed when chosen; a category with nothing listed leaves (All always stays). */
export function categoryChip(category: LibraryCategory, selected: LibraryCategory, available: ReadonlySet<LibraryCategory>): { readonly isPressed: boolean; readonly isHidden: boolean } {
  return { isPressed: category === selected, isHidden: category !== "all" && !available.has(category) };
}

/** All and the nine categories as chips; one pressed. */
export function createLibraryCategories(choose: (category: LibraryCategory) => void): LibraryCategories {
  const chips = LIBRARY_CATEGORIES.map((category) => ({
    category,
    chip: button("ui-pill ui-pill--chip", category === "all" ? text.all : () => groupLabels[category], () => choose(category)),
  }));
  const root = element("div", { className: "ui-library__categories", attributes: { role: "group", "aria-label": text.categories } }, chips.map(({ chip }) => chip));
  return {
    root,
    update(selected, available) {
      for (const { category, chip } of chips) {
        const state = categoryChip(category, selected, available);
        setPressed(chip, state.isPressed);
        chip.hidden = state.isHidden;
      }
    },
  };
}
