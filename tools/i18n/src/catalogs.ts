// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Every catalog of the system with its translations. A new catalog is one entry here; a
// new locale is one translation module per catalog.
import type { Catalog, TranslationModule } from "@untzel/i18n";
import { strings as docsStrings } from "../../../apps/docs/src/strings";
import docsPortuguese from "../../../apps/docs/src/strings.pt-BR";
import { announcements } from "../../../apps/web/src/strings/en";
import { instrumentText } from "../../../apps/web/src/strings/instruments";
import instrumentsPortuguese from "../../../apps/web/src/strings/instruments.pt-BR";
import webPortuguese from "../../../apps/web/src/strings/pt-BR";
import { effectLabels, exportLabels, groupLabels, phrases, strings as controlsStrings } from "../../../packages/skins/booth/src/copy/strings";
import { exportStretchPhrases, exportStretchStrings, rangePhrases, rangeStrings } from "../../../packages/skins/booth/src/copy/range-strings";
import {
  exportStretchPhrasesPtBr,
  exportStretchStringsPtBr,
  rangePhrasesPtBr,
  rangeStringsPtBr,
} from "../../../packages/skins/booth/src/copy/range-strings.pt-BR";
import {
  effectLabelsPtBr,
  exportLabelsPtBr,
  groupLabelsPtBr,
  phrasesPtBr,
  stringsPtBr,
} from "../../../packages/skins/booth/src/copy/strings.pt-BR";
import {
  assistStrings as commandsAssist,
  commandSummaries,
  explainStrings as commandsExplain,
  strings as commandsStrings,
} from "../../../packages/commands/src/copy/strings";
import {
  assistStringsPtBr,
  commandSummariesPtBr,
  explainStringsPtBr,
  stringsPtBr as commandsPortuguese,
} from "../../../packages/commands/src/copy/strings.pt-BR";
import { strings as editorStrings } from "../../../packages/editor/src/copy/strings";
import editorPortuguese from "../../../packages/editor/src/copy/strings.pt-BR";
import { englishMessages } from "../../../packages/language/src/copy/messages";
import languagePortuguese from "../../../packages/language/src/copy/messages.pt-BR";

export interface CatalogEntry {
  /** Where the English source lives, for the report. */
  readonly name: string;
  readonly source: Catalog;
  readonly translations: readonly TranslationModule<Catalog>[];
}

function entry<C extends Catalog>(name: string, source: C, translations: readonly TranslationModule<C>[]): CatalogEntry {
  return { name, source, translations: translations as unknown as readonly TranslationModule<Catalog>[] };
}

export const CATALOGS: readonly CatalogEntry[] = [
  entry("controls strings (packages/skins/booth/src/copy/strings.ts)", controlsStrings, [stringsPtBr]),
  entry("controls exportLabels", exportLabels, [exportLabelsPtBr]),
  entry("controls groupLabels", groupLabels, [groupLabelsPtBr]),
  entry("controls phrases", phrases, [phrasesPtBr]),
  entry("controls effectLabels", effectLabels, [effectLabelsPtBr]),
  entry("controls play range (packages/skins/booth/src/copy/range-strings.ts)", rangeStrings, [rangeStringsPtBr]),
  entry("controls play range phrases", rangePhrases, [rangePhrasesPtBr]),
  entry("controls export stretch", exportStretchStrings, [exportStretchStringsPtBr]),
  entry("controls export stretch phrases", exportStretchPhrases, [exportStretchPhrasesPtBr]),
  entry("instrument and sound descriptions (instruments/*/manifest.json)", instrumentText, [instrumentsPortuguese]),
  entry("editor and terminal (packages/editor/src/copy/strings.ts)", editorStrings, [editorPortuguese]),
  entry("command results (packages/commands/src/copy/strings.ts)", commandsStrings, [commandsPortuguese]),
  entry("command summaries", commandSummaries, [commandSummariesPtBr]),
  entry("command completion and hover", commandsAssist, [assistStringsPtBr]),
  entry("command explain", commandsExplain, [explainStringsPtBr]),
  entry("language messages (packages/language/src/copy/messages.ts)", englishMessages, [languagePortuguese]),
  entry("web announcements (apps/web/src/strings/en.ts)", announcements, [webPortuguese]),
  entry("docs frame (apps/docs/src/strings.ts)", docsStrings, [docsPortuguese]),
];

/** The pages of the docs: an English source <id>.md and its translations <id>.<locale>.md. */
export const DOCS_CONTENT = "apps/docs/content";
