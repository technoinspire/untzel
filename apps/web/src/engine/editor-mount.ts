// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Loaded the first time Code opens: CodeMirror and the composer terminal stay out of
// the initial JS. The editor adopts its own CSS, so this chunk loads no stylesheet.

import { addCommandsTranslations, Composer, installCommandsTranslator } from "@untzel/commands";
import type { InstrumentRegistry } from "@untzel/core";
import { addEditorTranslation, createCodeArea, type Announcer, type CodePort, type TerminalPort } from "@untzel/editor";
import type { Translator } from "@untzel/i18n";
import { instrumentDescription, soundDescription } from "../strings/instrument-copy";
import { onCodeTranslations } from "../strings/languages";

export interface EditorHandle {
  applyNow(): void;
}

export interface EditorPorts {
  readonly code: CodePort;
  readonly terminal: TerminalPort;
  readonly registry: InstrumentRegistry;
  /** The page's live region: new errors in the code are announced there. */
  readonly announcer: Announcer;
}

/** `translator`: the page's, so the editor and the commands speak the language of the controls. */
export function mountEditor(host: HTMLElement, ports: EditorPorts, translator: Translator): EditorHandle {
  // The page loads a language's catalogs before it speaks it; the Code panel's arrive here.
  onCodeTranslations(({ editor, commands }) => {
    addEditorTranslation(editor);
    addCommandsTranslations(commands);
  });
  installCommandsTranslator(translator);
  // One composer for the editor's help and the terminal's commands, on the same registry;
  // the hover help describes instruments and sounds with the library's translations.
  const composer = new Composer(ports.registry, { instrument: instrumentDescription, sound: soundDescription });
  return createCodeArea({
    host,
    code: ports.code,
    help: composer,
    terminal: ports.terminal,
    commands: composer,
    announcer: ports.announcer,
    translator,
  });
}
