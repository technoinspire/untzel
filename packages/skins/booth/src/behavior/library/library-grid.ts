// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The accessible structure of the library, as plain
// data tested in Node: the search is a combobox that controls a grid; each instrument
// is a row whose buttons sit in their own gridcells, so no interactive control is
// nested in another; the active row is named by the id of its name cell; a polite
// status region announces the audition. The views only apply these attributes.
import { searchLabel } from "./library-labels";

/** A reader (`() => string`) is bound by the dom helpers: a language change rewrites it. */
type Attributes = Readonly<Record<string, string | number | boolean | (() => string)>>;

/** The id of the grid of instruments, which the search combobox controls. */
export const LIBRARY_GRID_ID = "ui-library-list";

export const GRID_ATTRIBUTES: Attributes = { id: LIBRARY_GRID_ID, role: "grid", "aria-label": "Instruments" };

export const ROW_ATTRIBUTES: Attributes = { role: "row" };

/**
 * The region that says "Playing piano, grand" and "Preview stopped". role=status is
 * polite by itself; no aria-live attribute, which stays unique to the app's notice
 * region (the share and file tests find that one by [aria-live]).
 */
export const STATUS_ATTRIBUTES: Attributes = { role: "status" };

export function comboboxAttributes(maxLength: number): Attributes {
  return {
    type: "search",
    role: "combobox",
    "aria-controls": LIBRARY_GRID_ID,
    "aria-expanded": "true",
    "aria-haspopup": "grid",
    "aria-autocomplete": "list",
    "aria-label": searchLabel,
    placeholder: searchLabel,
    maxlength: maxLength,
    autocomplete: "off",
  };
}

/** A gridcell; the name cell of an instrument also carries the id the combobox points at. */
export function cellAttributes(id?: string): Attributes {
  return id === undefined ? { role: "gridcell" } : { role: "gridcell", id };
}

/** The DOM id of an instrument's name cell. */
export function nameCellId(instrument: string): string {
  return `ui-library-row-${instrument}`;
}

/** The value of the search's aria-activedescendant, or null when no row is shown. */
export function activeDescendant(instruments: readonly string[], active: number): string | null {
  const instrument = instruments[active];
  return instrument === undefined ? null : nameCellId(instrument);
}
