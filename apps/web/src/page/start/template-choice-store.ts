// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The template picker's last choice, in this browser only (the style and the project
// are remembered). Part of the initial JS. A choice the library no longer has is ignored
// by the page, which then opens on the first-touch template.

import type { TemplateChoice } from "../waiting/waiting-stage";

export const TEMPLATE_CHOICE_KEY = "untzel:template-choice";
const FORMAT_VERSION = 1;

export class TemplateChoiceStore {
  readonly #storage: Storage | null;

  /** `storage` is window.localStorage on the page (null when reading it throws), a fake in tests. */
  constructor(storage: Storage | null) {
    this.#storage = storage;
  }

  load(): TemplateChoice | null {
    let raw: string | null = null;
    try {
      raw = this.#storage?.getItem(TEMPLATE_CHOICE_KEY) ?? null;
    } catch {
      return null;
    }
    return raw === null ? null : parse(raw);
  }

  /** Quota and security errors are ignored: the picker only forgets the choice. */
  save(choice: TemplateChoice): void {
    try {
      this.#storage?.setItem(TEMPLATE_CHOICE_KEY, JSON.stringify({ v: FORMAT_VERSION, ...choice }));
    } catch {
      // Nothing to do: the next visit opens on the first-touch template.
    }
  }
}

function parse(raw: string): TemplateChoice | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as { readonly v?: unknown; readonly template?: unknown; readonly openStyle?: unknown };
  if (record.v !== FORMAT_VERSION || typeof record.template !== "string") return null;
  return { template: record.template, openStyle: typeof record.openStyle === "string" ? record.openStyle : null };
}
