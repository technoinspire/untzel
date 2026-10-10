// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The waiting stage's template picker and what it says about text that arrived.
import type { Key } from "@untzel/core";

/** What the waiting stage says about text that arrived: a link or a file to remix, or why it failed. */
export type ReceivedNotice =
  | { readonly kind: "remix"; readonly from: "link" | "file" }
  | { readonly kind: "failed"; readonly message: string };

/** A style tab of the template picker (a folder of the template library). */
export interface TemplateStyleView {
  readonly id: string;
  readonly label: string;
}

/** Tempo and key of a project, read from its analyzed program. */
export interface TemplateSummaryView {
  readonly bpm: number;
  readonly key: Key;
}

export interface TemplateProjectView {
  /** "<style>/<project>", for example "house/disco-lights". */
  readonly id: string;
  readonly style: string;
  readonly name: string;
  /** Null until the engine's code has analyzed the template. */
  readonly summary: TemplateSummaryView | null;
}

export interface TemplateCatalogView {
  /** The Blank project (blank.untzel), shown first and outside the style tabs; null without one. */
  readonly blank: TemplateProjectView | null;
  /** In tab order. */
  readonly styles: readonly TemplateStyleView[];
  /** By style, then in each style's order. */
  readonly projects: readonly TemplateProjectView[];
}

export interface TemplatesView {
  readonly catalog: TemplateCatalogView;
  readonly selected: string;
  /** The style tab last opened; null opens the selected template's style. */
  readonly openStyle: string | null;
  readonly notice: ReceivedNotice | null;
}
