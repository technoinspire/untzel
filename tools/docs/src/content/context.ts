// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What a page render sees: the build data, its locale and frame copy, and where it collects
// errors and the examples it cites.
import { createFormatters, translateCatalog, type Formatters, type Locale } from "@untzel/i18n";
import portuguese from "../../../../apps/docs/src/strings.pt-BR";
import { strings } from "../../../../apps/docs/src/strings";
import type { FeatureStates } from "./features";
import type { DocsSources } from "./sources";

export type FrameText = typeof strings;

export interface BuildData {
  readonly sources: DocsSources;
  readonly features: FeatureStates;
  /** The copyable prompt, generated once from the same sources. */
  readonly prompt: string;
}

export interface RenderContext {
  readonly data: BuildData;
  readonly locale: Locale;
  readonly text: FrameText;
  readonly formatters: Formatters;
  /** Path of the page below the docs root. */
  readonly path: string;
  /** Source file, for error messages. */
  readonly file: string;
  readonly errors: string[];
  /** Example ids in the order the page cites them. */
  readonly examples: string[];
  /** Every code block written on the page, in order; its position gives the element id. */
  readonly codeIds: string[];
}

export function frameText(locale: Locale): FrameText {
  return translateCatalog(strings, [portuguese], locale, createFormatters(locale));
}

/** A number as the locale writes it, without rounding what the source says. */
export function formatNumber(context: Pick<RenderContext, "formatters">, value: number): string {
  return context.formatters.number(value, { maximumFractionDigits: 6, useGrouping: Math.abs(value) >= 10_000 });
}
