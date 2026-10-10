// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import editorCss from "./editor.css?inline";
import { adoptStyleSheet } from "./style-sheet-adoption";

// The editor's CSS as a constructed sheet. CodeMirror's patched style-mod puts
// its own sheet first in document.adoptedStyleSheets; this one goes last, so the editor
// CSS keeps winning CodeMirror's ties (the error underline, the sections' padding, the
// phone's hanging indent) as it did when CodeMirror wrote a <style> before our <link>.

export function adoptEditorStyleSheet(document: Document): void {
  adoptStyleSheet(document, editorCss);
}
