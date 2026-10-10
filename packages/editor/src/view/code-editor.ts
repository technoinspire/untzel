// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import { Compartment, EditorState, Prec, type Extension } from "@codemirror/state";
import { drawSelection, EditorView, keymap, lineNumbers } from "@codemirror/view";
import type { Translator } from "@untzel/i18n";
import { codeAssist } from "../assist/assist";
import { ChangeNotice } from "../diagnostics/change-notice";
import { installTranslator, strings, translator } from "../copy/copy";
import { cursorStaysInView } from "./cursor-in-view";
import { setSounding, untzelDecorations } from "../highlight/decorations";
import { soundingOnDocument } from "../sync/sounding-on-document";
import { DiagnosticsBridge } from "../diagnostics/diagnostics-bridge";
import { adoptEditorStyleSheet } from "../styles/editor-style-sheet";
import { escapeToLeave } from "./escape-to-leave";
import { languageMarks } from "../highlight/language-marks";
import { responsiveWrapping } from "./line-wrapping";
import type { Announcer, CodeHelp, CodePort, CodeState } from "../ports";
import { untzelSyntax } from "../highlight/syntax";
import { untzelTheme } from "../highlight/theme";
import { trackGutter } from "../highlight/track-gutter";
import { TypingBridge } from "../sync/typing-bridge";

// The code editor: the session's text in the Untzel language mode, with the
// sounding tokens, the diagnostics and their fixes, and the lines the interface changed.

export { TYPING_PAUSE_MS } from "../sync/typing-bridge";
export const CHANGED_LINE_MS = 1000;

export interface CodeEditorOptions {
  readonly host: HTMLElement;
  readonly port: CodePort;
  /** How long a changed line stays lit; the preview holds it for screenshots. */
  readonly changedLineMs?: number;
  /** Completion and hover help; without it the editor only shows the text. */
  readonly help?: CodeHelp;
  /** The page's live region: new errors, "No fix here", how to leave. */
  readonly announcer?: Announcer;
  /** The language of the messages and labels; English without one. */
  readonly translator?: Translator;
}

/** The source's accessible name, reconfigured when the language changes. */
const sourceLabel = new Compartment();

function sourceLabelAttributes(): Extension {
  return EditorView.contentAttributes.of({ "aria-label": strings.sourceLabel });
}

/** The hidden description that tells how to leave, before any Esc. */
const LEAVE_HINT_ID = "untzel-editor-leave-hint";

export interface CodeEditor {
  readonly view: EditorView;
  /** Flushes pending typing and applies on the next bar (Mod+Enter). */
  applyNow(): void;
  destroy(): void;
}

function extensionsFor(options: CodeEditorOptions, typing: TypingBridge, diagnostics: DiagnosticsBridge): Extension[] {
  const { port } = options;
  const announce = (message: string): void => options.announcer?.announce(message);
  return [
    trackGutter(),
    lineNumbers(),
    drawSelection(),
    responsiveWrapping(),
    cursorStaysInView(),
    sourceLabel.of(sourceLabelAttributes()),
    EditorView.contentAttributes.of({ spellcheck: "false", autocapitalize: "off", autocorrect: "off", "aria-describedby": LEAVE_HINT_ID }),
    untzelSyntax(),
    languageMarks(),
    untzelTheme(),
    untzelDecorations(),
    diagnostics.extension(),
    ...(options.help === undefined ? [] : [codeAssist(options.help)]),
    // Each key is the editor's alone: stopPropagation keeps the page's shortcuts from
    // running it a second time (one Mod+Z, one step back).
    Prec.highest(keymap.of([
      { key: "Mod-Enter", run: () => typing.applyNow(), stopPropagation: true },
      // Outside the editor Mod+. stops the music; here it fixes, and never stops.
      {
        key: "Mod-.",
        run: () => {
          if (!diagnostics.fixFirst()) announce(strings.noFixHere);
          return true;
        },
        stopPropagation: true,
      },
      { key: "Mod-z", run: () => (port.undo(), true), stopPropagation: true },
      { key: "Mod-Shift-z", run: () => (port.redo(), true), stopPropagation: true },
      { key: "Mod-y", run: () => (port.redo(), true), stopPropagation: true },
    ])),
    escapeToLeave(() => announce(strings.tabLeaves)),
    keymap.of([...defaultKeymap, indentWithTab]),
    EditorView.updateListener.of((update) => typing.typed(update)),
  ];
}

// Over 40 lines: one editor built and wired; its bridges, notice and hint are their own modules, and its subscriptions are released together.
export function createCodeEditor(options: CodeEditorOptions): CodeEditor {
  const { port, host } = options;
  if (options.translator !== undefined) installTranslator(options.translator);
  const typing = new TypingBridge(port);
  const diagnostics = new DiagnosticsBridge(() => typing.applyNow(), (message) => options.announcer?.announce(message));
  const state = EditorState.create({ doc: port.code().source, extensions: extensionsFor(options, typing, diagnostics) });
  adoptEditorStyleSheet(host.ownerDocument);
  const view = new EditorView({ parent: host, state });
  typing.view = view;
  diagnostics.view = view;
  const notice = new ChangeNotice();
  // aria-describedby reads a hidden node: the hint is said on focus and never shows.
  const leaveHint = host.ownerDocument.createElement("p");
  leaveHint.id = LEAVE_HINT_ID;
  leaveHint.hidden = true;
  leaveHint.textContent = strings.escThenTab;
  host.classList.add("untzel-editor");
  host.append(diagnostics.panel, notice.element, leaveHint);

  let programSource = port.code().programSource;
  const render = (code: CodeState): void => {
    programSource = code.programSource;
    typing.incoming(view, code.source);
    diagnostics.show(code);
    notice.show(view, code, options.changedLineMs ?? CHANGED_LINE_MS);
  };
  const unsubscribe = port.subscribe(render);
  // A language change redraws the messages and the label; the document and its undo
  // history stay as they are.
  const unsubscribeLocale = translator.onChange(() => {
    view.dispatch({ effects: sourceLabel.reconfigure(sourceLabelAttributes()) });
    leaveHint.textContent = strings.escThenTab;
    diagnostics.refresh();
  });
  // The ranges point into the program that plays; the document may differ.
  const unsubscribeSounding = port.onSounding((ranges) => {
    const shown = soundingOnDocument(ranges, programSource, view.state.doc.toString());
    view.dispatch({ effects: setSounding.of(shown) });
  });
  render(port.code());

  return {
    view,
    applyNow: () => void typing.applyNow(),
    destroy() {
      typing.flush();
      unsubscribe();
      unsubscribeSounding();
      unsubscribeLocale();
      view.destroy();
      diagnostics.panel.remove();
      leaveHint.remove();
      notice.destroy();
    },
  };
}
