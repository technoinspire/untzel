// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Diagnostic, DiagnosticFix } from "@untzel/language";
import { fixTitle, messageText, strings } from "../copy/copy";

// The error block under the code: the message,
// "the previous version keeps playing", a flare button with the known fix and an
// outline "Ignore". A warning gets the same block without that line: the text it is
// about is the one playing. A view:
// diagnostics in, a fix or a dismissal out.

const MAX_SHOWN = 3;

export interface ProblemActions {
  readonly fix: (fix: DiagnosticFix) => void;
  /** Hides this error until the text changes. */
  readonly ignore: (diagnostic: Diagnostic) => void;
}

/** A stable key for an error, to hide what the person ignored. */
export function problemKey(diagnostic: Diagnostic): string {
  return `${diagnostic.code}:${diagnostic.from}:${diagnostic.message}`;
}

/** The problems the block shows: errors first, then warnings, none ignored, at most three. */
export function shownProblems(diagnostics: readonly Diagnostic[], ignored: ReadonlySet<string>): Diagnostic[] {
  const open = diagnostics.filter((diagnostic) => !ignored.has(problemKey(diagnostic)));
  const errors = open.filter((diagnostic) => diagnostic.severity === "error");
  const warnings = open.filter((diagnostic) => diagnostic.severity === "warning");
  return [...errors, ...warnings].slice(0, MAX_SHOWN);
}

export function renderProblems(container: HTMLElement, problems: readonly Diagnostic[], actions: ProblemActions): void {
  // The shown text is part of the key, so a language change redraws the block.
  const key = problems
    .map((problem) => `${problemKey(problem)}:${messageText(problem)}:${problem.fix === undefined ? "" : fixTitle(problem.fix)}:${strings.ignore}`)
    .join("|");
  if (container.dataset["key"] === key) return;
  container.dataset["key"] = key;
  container.replaceChildren(...problems.map((problem) => problemBlock(problem, actions)));
  container.hidden = problems.length === 0;
}

function text(tag: "p", className: string, content: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = content;
  return node;
}

function actionButton(className: string, label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function problemBlock(problem: Diagnostic, actions: ProblemActions): HTMLElement {
  const block = document.createElement("div");
  const warning = problem.severity === "warning";
  block.className = warning ? "untzel-editor__problem untzel-editor__problem--warning" : "untzel-editor__problem";
  const message = messageText(problem);
  block.append(text("p", "untzel-editor__message", message));
  if (!warning) block.append(text("p", "untzel-editor__keeps", strings.keepsPlaying));
  const row = document.createElement("div");
  row.className = "untzel-editor__fixes";
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", strings.fixesFor(message));
  const { fix } = problem;
  if (fix !== undefined) row.append(actionButton("untzel-editor__fix", fixTitle(fix), () => actions.fix(fix)));
  row.append(actionButton("untzel-editor__ignore", strings.ignore, () => actions.ignore(problem)));
  block.append(row);
  return block;
}
