// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The keys of the library search. The search is a
// combobox over the grid of instruments: the arrows move the active row, Enter adds it,
// Alt+Enter plays or stops its preview, every other key types. Pure, tested in Node.

export interface ComboboxKey {
  readonly key: string;
  readonly altKey: boolean;
}

export interface ComboboxState {
  /** Rows shown. */
  readonly count: number;
  /** Index of the active row. */
  readonly active: number;
}

export type ComboboxAction =
  | { readonly kind: "move"; readonly active: number }
  | { readonly kind: "add" }
  | { readonly kind: "toggle-preview" };

/** The action of a key in the search, or null when the key only types. */
export function comboboxAction(event: ComboboxKey, state: ComboboxState): ComboboxAction | null {
  const { count, active } = state;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (count === 0) return { kind: "move", active: 0 };
    const step = event.key === "ArrowDown" ? 1 : count - 1;
    return { kind: "move", active: (active + step) % count };
  }
  if (event.key !== "Enter" || active < 0 || active >= count) return null;
  return event.altKey ? { kind: "toggle-preview" } : { kind: "add" };
}
