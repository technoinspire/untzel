// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { Annotation } from "@codemirror/state";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import type { CodePort } from "../ports";
import { SessionSync } from "./session-sync";

// Typing goes to the session after a short pause; the session's text comes back in.
// The editor never keeps text of its own.

export const TYPING_PAUSE_MS = 300;

/** Marks transactions that carry the session's text, so they are not echoed back. */
const fromSession = Annotation.define<boolean>();

export class TypingBridge {
  readonly #port: CodePort;
  readonly #sync: SessionSync;
  #timer: number | undefined;
  view: EditorView | null = null;

  constructor(port: CodePort) {
    this.#port = port;
    this.#sync = new SessionSync(port.code().source);
  }

  /** What the person typed; it reaches the session when the pause ends. */
  typed(update: ViewUpdate): void {
    if (!update.docChanged) return;
    const typed = update.transactions.filter((transaction) => transaction.docChanged && transaction.annotation(fromSession) !== true);
    if (typed.length === 0) return;
    for (const transaction of typed) this.#sync.recordLocal(transaction.changes);
    this.flush();
    this.#timer = window.setTimeout(() => this.#send((source) => this.#port.edit(source)), TYPING_PAUSE_MS);
  }

  flush(): void {
    window.clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  /** Mod+Enter: apply on the next bar without waiting for the pause. */
  applyNow(): boolean {
    this.flush();
    this.#send((source) => this.#port.applyNow(source));
    return true;
  }

  /** The session's text wins; a change made during a typing pause joins the typing. */
  incoming(view: EditorView, source: string): void {
    const changes = this.#sync.incoming(source);
    if (changes !== null) view.dispatch({ changes, annotations: fromSession.of(true) });
  }

  /** The document goes to the session; set first, because the session answers synchronously. */
  #send(deliver: (source: string) => void): void {
    this.#timer = undefined;
    const source = this.view?.state.doc.toString() ?? "";
    this.#sync.sent(source);
    deliver(source);
  }
}
