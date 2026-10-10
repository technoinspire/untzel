// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { createTranslator } from "@untzel/i18n";
import type { Diagnostic } from "@untzel/language";
import { afterEach, describe, expect, it } from "vitest";
import { addEditorTranslation, installTranslator } from "../copy/copy";
import portuguese from "../copy/strings.pt-BR";
import { heardKey, nextAnnouncement } from "./problem-announcement";

const kik: Diagnostic = {
  code: "UNKNOWN_INSTRUMENT",
  message: 'Unknown instrument "kik".',
  messageKey: "unknownInstrument",
  messageArgs: ["kik", null],
  from: 40,
  to: 43,
  severity: "error",
};
const cutof: Diagnostic = {
  code: "UNKNOWN_MODIFIER",
  message: '"bass" has no parameter "cutof".',
  messageKey: "unknownModifier",
  messageArgs: ["bass", "cutof", null],
  from: 90,
  to: 95,
  severity: "error",
};
const lineOf = (offset: number): number => Math.floor(offset / 20) + 1;

describe("problem announcement", () => {
  addEditorTranslation(portuguese);
  afterEach(() => installTranslator(createTranslator("en")));

  it("says the line, the message and that the music goes on", () => {
    expect(nextAnnouncement(new Set(), [kik], lineOf)).toBe('Line 3: Unknown instrument "kik". The previous version keeps playing.');
  });

  it("announces only an error that was not there before, even when it moved", () => {
    const heard = new Set([heardKey(kik)]);
    expect(nextAnnouncement(heard, [{ ...kik, from: 60, to: 63 }], lineOf)).toBeNull();
    expect(nextAnnouncement(heard, [kik, cutof], lineOf)).toBe('Line 5: "bass" has no parameter "cutof". The previous version keeps playing.');
  });

  it("speaks the current language", () => {
    installTranslator(createTranslator("pt-BR"));
    expect(nextAnnouncement(new Set(), [kik], lineOf)).toBe('Linha 3: Instrumento desconhecido "kik". A versão anterior continua tocando.');
  });

  it("stays quiet when the code is fine", () => {
    expect(nextAnnouncement(new Set([heardKey(kik)]), [], lineOf)).toBeNull();
  });
});
