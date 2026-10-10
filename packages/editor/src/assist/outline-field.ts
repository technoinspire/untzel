// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { syntaxTree } from "@codemirror/language";
import { StateField } from "@codemirror/state";
import { readOutline, type CodeOutline } from "./code-outline";

/** The outline of the current document, read again when the text or its tree changes. */
export const outlineField = StateField.define<CodeOutline>({
  create: (state) => readOutline(state.doc.toString(), syntaxTree(state)),
  update(value, transaction) {
    if (!transaction.docChanged && syntaxTree(transaction.state) === syntaxTree(transaction.startState)) return value;
    return readOutline(transaction.state.doc.toString(), syntaxTree(transaction.state));
  },
});
