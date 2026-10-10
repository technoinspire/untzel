// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The text the open export sheet shows: a text with another hash means another
// file, so the render of the old one stops. Renaming keeps the hash.
import type { Session, Unsubscribe } from "@untzel/session";

export class ExportTextFollow {
  readonly #session: Session;
  readonly #onOtherText: () => void;
  /** The text hash the open sheet shows. */
  #followedHash: number | null = null;
  #unsubscribe: Unsubscribe | null = null;

  constructor(session: Session, onOtherText: () => void) {
    this.#session = session;
    this.#onOtherText = onOtherText;
  }

  /** From now: the text of this moment is the sheet's. */
  follow(): void {
    const session = this.#session;
    this.#followedHash = session.state().program?.sourceHash ?? null;
    this.#unsubscribe ??= session.subscribe(() => {
      const hash = session.state().program?.sourceHash ?? null;
      if (hash === this.#followedHash) return;
      this.#followedHash = hash;
      this.#onOtherText();
    });
  }

  stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }
}
