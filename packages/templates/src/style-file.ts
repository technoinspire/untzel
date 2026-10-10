// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Each style folder has a style.json: { "label": "House", "order": 4 }. The label is
// what the style tab reads; the order is the tab's position, 1 first.

export interface StyleFile {
  readonly label: string;
  readonly order: number;
}

/** The style of a style.json text, or null when it is not JSON or a field is wrong. */
export function parseStyleFile(text: string): StyleFile | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { label, order } = value as { readonly label?: unknown; readonly order?: unknown };
  if (typeof label !== "string" || label.trim() === "") return null;
  if (typeof order !== "number" || !Number.isInteger(order) || order < 1) return null;
  return { label: label.trim(), order };
}
