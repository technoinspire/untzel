// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The pt-BR catalogs of the command layer, as one entry point the composition loads on
// demand (`@untzel/commands/pt-BR`) and the docs generator reads at build time.
import type { CommandsTranslations } from "./copy";
import { assistStringsPtBr, commandSummariesPtBr, explainStringsPtBr, stringsPtBr } from "./strings.pt-BR";

export { commandSummariesPtBr } from "./strings.pt-BR";

export const commandsPortuguese: CommandsTranslations = {
  strings: stringsPtBr,
  summaries: commandSummariesPtBr,
  assist: assistStringsPtBr,
  explain: explainStringsPtBr,
};
