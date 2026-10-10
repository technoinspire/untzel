// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

export type {
  ActionResult,
  Announcer,
  CodeHelp,
  CodeState,
  CodePort,
  InterfaceChange,
  TerminalCommands,
  TerminalPort,
  TerminalState,
  TextRange,
} from "./ports";
export type { CodeEditor, CodeEditorOptions } from "./view/code-editor";
export { CHANGED_LINE_MS, TYPING_PAUSE_MS, createCodeEditor } from "./view/code-editor";
export type { CodeArea, CodeAreaOptions } from "./view/code-area";
export { createCodeArea } from "./view/code-area";
export { addEditorTranslation, type EditorTranslation } from "./copy/copy";
export { SPLIT_MAX_RATIO, SPLIT_MIN_PX, SPLIT_STEP_PX, clampSplit } from "./view/split-separator";
export { COMMAND_HISTORY_LIMIT, CommandHistory } from "./terminal/history";
export { TOKEN_CLASSES, untzelLanguage, untzelSyntax, type TokenCategory } from "./highlight/syntax";
export { normalizeRanges } from "./highlight/decorations";
