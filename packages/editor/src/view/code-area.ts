// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { Translator } from "@untzel/i18n";
import { createCodeEditor, type CodeEditor } from "./code-editor";
import type { Announcer, CodeHelp, CodePort, TerminalCommands, TerminalPort } from "../ports";
import { createSplitSeparator } from "./split-separator";
import { text } from "../copy/copy";
import { el } from "../terminal/dom";
import { promptGlyph } from "../terminal/icons";
import { createTerminal, type Terminal } from "../terminal/terminal";

// The Code panel's body: the code, and under it
// the command line behind a small "Commands" toggle, closed by default. The code is
// the main view; the commands are a secondary way to make the same edits.

export interface CodeAreaOptions {
  readonly host: HTMLElement;
  readonly code: CodePort;
  readonly help: CodeHelp;
  readonly terminal: TerminalPort;
  readonly commands: TerminalCommands;
  readonly announcer: Announcer;
  readonly commandsOpen?: boolean;
  /** The language of the code area; English without one. */
  readonly translator?: Translator;
}

export interface CodeArea {
  readonly editor: CodeEditor;
  readonly terminal: Terminal;
  setCommandsOpen(open: boolean): void;
  applyNow(): void;
  destroy(): void;
}

// Over 40 lines: one area built and wired; its editor, terminal and separator are their own modules.
export function createCodeArea(options: CodeAreaOptions): CodeArea {
  const area = el("div", "ut-area");
  const codePane = el("div", "ut-area__code");
  const terminalPane = el("div", "ut-area__terminal");
  terminalPane.id = `${options.host.id === "" ? "ut" : options.host.id}-commands`;
  const toggle = el("button", "ut-commands-toggle", undefined, promptGlyph("ut-glyph ut-glyph--prompt"), el("span", "", text.commands));
  toggle.type = "button";
  toggle.setAttribute("aria-controls", terminalPane.id);
  const separator = createSplitSeparator(area);
  area.append(codePane, el("div", "ut-area__bar", undefined, toggle), separator, terminalPane);
  options.host.append(area);

  const editor = createCodeEditor({
    host: codePane,
    port: options.code,
    help: options.help,
    announcer: options.announcer,
    ...(options.translator === undefined ? {} : { translator: options.translator }),
  });
  const terminal = createTerminal({ port: options.terminal, commands: options.commands });
  terminalPane.append(terminal.root);

  const setCommandsOpen = (open: boolean): void => {
    area.dataset["commands"] = open ? "open" : "closed";
    toggle.setAttribute("aria-expanded", String(open));
    terminalPane.hidden = !open;
    separator.hidden = !open;
    if (open) terminal.focus();
  };
  toggle.addEventListener("click", () => setCommandsOpen(area.dataset["commands"] !== "open"));
  setCommandsOpen(options.commandsOpen ?? false);

  return {
    editor,
    terminal,
    setCommandsOpen,
    applyNow: () => editor.applyNow(),
    destroy() {
      editor.destroy();
      terminal.destroy();
      area.remove();
    },
  };
}
