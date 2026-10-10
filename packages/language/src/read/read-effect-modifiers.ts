// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { effectParameter, type EffectKind, type WrittenValue } from "@untzel/core";
import type { DiagnosticList } from "../diagnostics/diagnostics";
import { rule, type ModulatorCounter } from "./modifier-values";
import type { ModifierSyntax } from "../highlight/outline";
import { readNumericValue } from "./read-values";

// Insert effect modifiers (`phaser 0.4`, `crush-bits 8`): their values and the chain
// order, which follows where each effect is first written.

export class EffectModifierReader {
  readonly #values = new Map<string, WrittenValue>();
  /** The last position of every effect modifier name: the chain order follows it. */
  readonly #lastPosition = new Map<string, number>();
  readonly #diagnostics: DiagnosticList;
  readonly #counted: ModulatorCounter;

  constructor(diagnostics: DiagnosticList, counted: ModulatorCounter) {
    this.#diagnostics = diagnostics;
    this.#counted = counted;
  }

  get values(): ReadonlyMap<string, WrittenValue> {
    return this.#values;
  }

  /** Returns false when the modifier is not an effect parameter. */
  read(modifier: ModifierSyntax, position: number): boolean {
    const name = modifier.name.text;
    const parameter = effectParameter(name);
    if (parameter === undefined) return false;
    this.#lastPosition.set(name, position);
    const effectRule = rule(name, parameter.min, parameter.max, String(parameter.added ?? parameter.default), { allowsFast: true });
    const value = this.#counted(modifier, readNumericValue(modifier, effectRule, this.#diagnostics));
    if (value === null) this.#values.delete(name);
    else this.#values.set(name, value);
    return true;
  }

  /** Effects in the order of the first of their modifiers that survived "the last wins". */
  order(): readonly EffectKind[] {
    const first = new Map<EffectKind, number>();
    for (const [name] of this.#values) {
      const parameter = effectParameter(name);
      const position = this.#lastPosition.get(name);
      if (parameter === undefined || position === undefined) continue;
      first.set(parameter.effect, Math.min(first.get(parameter.effect) ?? Infinity, position));
    }
    return [...first].sort((a, b) => a[1] - b[1]).map(([effect]) => effect);
  }
}
