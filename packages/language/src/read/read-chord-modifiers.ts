// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  ARP_MODES,
  VOICINGS,
  rational,
  type ArpMode,
  type ArpSpec,
  type InstrumentManifest,
  type Rational,
  type Voicing,
} from "@untzel/core";
import type { DiagnosticList } from "../diagnostics/diagnostics";
import { messages } from "../copy/messages";
import { ARP_RATES, RULES, constantOf, divisionText, readName } from "./modifier-values";
import type { ModifierSyntax } from "../highlight/outline";
import { readNumericValue } from "./read-values";

// voicing, inversion and the arpeggiator (arp, arp-rate, arp-octaves): chord instruments
// only. Any other instrument gets a NO_EFFECT warning and the modifier is ignored.

const DEFAULT_ARP_RATE = rational(1n, 16n);
const CHORD_MODIFIERS: ReadonlySet<string> = new Set(["voicing", "inversion", "arp", "arp-rate", "arp-octaves"]);

export class ChordModifierReader {
  #voicing: Voicing | null = null;
  #inversion = 0;
  #arpMode: ArpMode | null = null;
  #arpRate: Rational | null = null;
  #arpOctaves: number | null = null;
  #arpRateModifier: ModifierSyntax | null = null;
  #arpOctavesModifier: ModifierSyntax | null = null;
  readonly #manifest: InstrumentManifest | null;
  readonly #diagnostics: DiagnosticList;

  constructor(manifest: InstrumentManifest | null, diagnostics: DiagnosticList) {
    this.#manifest = manifest;
    this.#diagnostics = diagnostics;
  }

  get voicing(): Voicing | null {
    return this.#voicing;
  }

  get inversion(): number {
    return this.#inversion;
  }

  /** Returns false when the modifier is not a chord one. */
  read(modifier: ModifierSyntax): boolean {
    const name = modifier.name.text;
    if (!CHORD_MODIFIERS.has(name)) return false;
    const diagnostics = this.#diagnostics;
    if (name === "voicing") {
      const voicing = readName(modifier, VOICINGS, diagnostics);
      if (voicing !== null && this.#requireChord(modifier)) this.#voicing = voicing;
    } else if (name === "inversion") {
      const value = constantOf(readNumericValue(modifier, RULES.inversion, diagnostics));
      if (value !== null && this.#requireChord(modifier)) this.#inversion = value;
    } else if (name === "arp") {
      const mode = readName(modifier, ARP_MODES, diagnostics);
      if (mode !== null && this.#requireChord(modifier)) this.#arpMode = mode;
    } else if (name === "arp-rate") {
      this.#readArpRate(modifier);
    } else {
      this.#arpOctavesModifier = modifier;
      this.#arpOctaves = constantOf(readNumericValue(modifier, RULES["arp-octaves"], diagnostics));
    }
    return true;
  }

  #readArpRate(modifier: ModifierSyntax): void {
    this.#arpRateModifier = modifier;
    const value = modifier.value;
    if (value === null) {
      this.#diagnostics.error("MISSING_VALUE", messages.missingValue("arp-rate", "arp-rate 1/16"), modifier.name);
    } else if (!ARP_RATES.includes(divisionText(modifier)) || value.kind !== "division") {
      this.#diagnostics.error("OUT_OF_RANGE", messages.arpRate(ARP_RATES), value);
    } else {
      this.#arpRate = rational(BigInt(value.numerator.text), BigInt(value.denominator.text));
    }
  }

  #requireChord(modifier: ModifierSyntax): boolean {
    const manifest = this.#manifest;
    if (manifest === null || manifest.kind === "chord") return true;
    this.#diagnostics.warning("NO_EFFECT", messages.noEffectWithoutChords(modifier.name.text, manifest.name), modifier);
    return false;
  }

  /** The arpeggiator; arp-rate or arp-octaves without arp warn and do nothing. */
  arp(): ArpSpec | null {
    if (this.#arpMode === null) {
      for (const modifier of [this.#arpRateModifier, this.#arpOctavesModifier]) {
        if (modifier === null) continue;
        this.#diagnostics.warning("NO_EFFECT", messages.noEffectWithoutArp(modifier.name.text), modifier);
      }
      return null;
    }
    return { mode: this.#arpMode, rate: this.#arpRate ?? DEFAULT_ARP_RATE, octaves: this.#arpOctaves ?? 1 };
  }
}
