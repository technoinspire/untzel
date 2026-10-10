// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentRegistry } from "@untzel/core";
import { analyze, type AnalyzeResult } from "@untzel/language";
import { CodeAssist, type CodeCompletion, type HoverHelp } from "../completion/code-assist";
import { MANIFEST_DESCRIBER, type Describer } from "./describer";
import { applySafeFixes, type FixAllResult } from "./fix-all";
import { completeLine, type LineCompletion } from "../completion/line-completion";
import type { CommandOutcome } from "./outcome";
import { runLine } from "./run";
import { Vocabulary } from "../reading/vocabulary";

/**
 * The composer's help, bound to one registry: command lines, their completion, and the
 * editor's completion and hover. Pure: it reads the text it is given and returns data;
 * applying a change is the caller's job (the terminal, through Session.applyText).
 * `describer` translates the manifests' descriptions; the manifests' English by default.
 */
export class Composer {
  readonly #vocabulary: Vocabulary;
  readonly #assist: CodeAssist;
  readonly #analyze: (source: string) => AnalyzeResult;

  constructor(registry: InstrumentRegistry, describer: Describer = MANIFEST_DESCRIBER) {
    this.#vocabulary = new Vocabulary(registry);
    this.#assist = new CodeAssist(this.#vocabulary, describer);
    this.#analyze = (source) => analyze(source, registry);
  }

  run(line: string, source: string): CommandOutcome {
    return runLine(line, { source, vocabulary: this.#vocabulary, analyze: this.#analyze });
  }

  completeLine(line: string, cursor: number, source: string): LineCompletion {
    return completeLine(line, cursor, this.#vocabulary, source);
  }

  completeCode(source: string, offset: number): CodeCompletion | null {
    return this.#assist.complete(source, offset);
  }

  hover(source: string, offset: number): HoverHelp | null {
    return this.#assist.hover(source, offset);
  }

  fixAll(source: string): FixAllResult {
    return applySafeFixes(source, this.#analyze);
  }
}
