// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The composer terminal's command layer: parsing, the plan of
// each command as a minimal text edit, quick fixes, completion and plain explanations.
// No DOM, clock, session or network.

export { COMMANDS, type ArgumentKind, type CommandSpec } from "./reading/catalog";
export type { CodeCompletion, HoverHelp } from "./completion/code-assist";
export { Composer } from "./proposal/composer";
export { MANIFEST_DESCRIBER, type Describer } from "./proposal/describer";
export { addCommandsTranslations, installCommandsTranslator, type CommandsTranslations } from "./copy/copy";
export { commandSummaries as englishCommandSummaries } from "./copy/strings";
export type { DiffLine } from "./proposal/diff";
export type { FixAllResult } from "./proposal/fix-all";
export { STARTER_COMMANDS, type Completion, type LineCompletion } from "./completion/line-completion";
export type { CommandOutcome, InfoLine, Proposal, SessionAction } from "./proposal/outcome";
export { propose, type ProposeOptions } from "./proposal/propose";
export { MAX_LINE_LENGTH } from "./reading/words";
