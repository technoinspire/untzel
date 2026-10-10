// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Unsubscribe } from "@untzel/session";

/** The listeners of one event of a sound port. */
export class Listeners<Value> {
  readonly #set = new Set<(value: Value) => void>();
  add(listener: (value: Value) => void): Unsubscribe {
    this.#set.add(listener);
    return () => this.#set.delete(listener);
  }

  emit(value: Value): void {
    for (const listener of this.#set) listener(value);
  }
}
