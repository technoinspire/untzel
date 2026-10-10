// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The pt-BR catalogs of the controls, as one entry point the composition loads on demand
// (`@untzel/skin/pt-BR`) and the docs generator reads at build time.
import type { ControlsTranslations } from "./copy";
import { exportStretchPhrasesPtBr, exportStretchStringsPtBr, rangePhrasesPtBr, rangeStringsPtBr } from "./range-strings.pt-BR";
import { effectLabelsPtBr, exportLabelsPtBr, groupLabelsPtBr, phrasesPtBr, stringsPtBr } from "./strings.pt-BR";
export { stringsPtBr } from "./strings.pt-BR";
export const controlsPortuguese: ControlsTranslations = {
  strings: stringsPtBr,
  formatLabels: exportLabelsPtBr,
  groupLabels: groupLabelsPtBr,
  phrases: phrasesPtBr,
  effectLabels: effectLabelsPtBr,
  rangeStrings: rangeStringsPtBr,
  rangePhrases: rangePhrasesPtBr,
  exportStretchStrings: exportStretchStringsPtBr,
  exportStretchPhrases: exportStretchPhrasesPtBr,
};
