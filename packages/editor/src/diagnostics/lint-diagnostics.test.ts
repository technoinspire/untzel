// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { createTranslator } from "@untzel/i18n";
import type { Diagnostic } from "@untzel/language";
import { afterEach, describe, expect, it } from "vitest";
import { addEditorTranslation, installTranslator } from "../copy/copy";
import portuguese from "../copy/strings.pt-BR";
import { firstFix, toLintDiagnostics } from "./lint-diagnostics";
import { problemKey, shownProblems } from "./quick-fixes";

const KIK: Diagnostic = {
  code: "UNKNOWN_INSTRUMENT",
  message: 'Unknown instrument "kik". Did you mean "kick"?',
  messageKey: "unknownInstrument",
  messageArgs: ["kik", "kick"],
  from: 6,
  to: 9,
  severity: "error",
  fix: { title: "Change to kick", titleKey: "fixChange", titleArgs: ["kick"], changes: [{ from: 6, to: 9, insert: "kick" }], safe: true },
};
const EMPTY: Diagnostic = {
  code: "EMPTY_PATTERN",
  message: "This track has no steps.",
  messageKey: "emptyPattern",
  messageArgs: [],
  from: 20,
  to: 24,
  severity: "error",
};
const WARN: Diagnostic = { ...EMPTY, code: "DUPLICATE_MODIFIER", severity: "warning", from: 30, to: 40 };

describe("lint diagnostics", () => {
  addEditorTranslation(portuguese);
  afterEach(() => installTranslator(createTranslator("en")));

  it("clamps ranges and turns a fix into the diagnostic's action", () => {
    const applied: string[] = [];
    const [kik, empty] = toLintDiagnostics([KIK, { ...EMPTY, to: 99 }], 30, (fix) => applied.push(fix.title));
    expect(kik).toMatchObject({ from: 6, to: 9, severity: "error", source: "UNKNOWN_INSTRUMENT" });
    expect(kik?.actions?.map((action) => action.name)).toEqual(["Change to kick"]);
    expect(empty).toMatchObject({ from: 20, to: 30 });
    expect(empty?.actions).toBeUndefined();
  });

  it("Mod+. takes the fix under the cursor, else the first one", () => {
    expect(firstFix([EMPTY, KIK], 7)?.title).toBe("Change to kick");
    expect(firstFix([EMPTY, KIK], 0)?.title).toBe("Change to kick");
    expect(firstFix([EMPTY], 0)).toBeNull();
  });

  it("the mark and its action read in the current language", () => {
    installTranslator(createTranslator("pt-BR"));
    const [kik] = toLintDiagnostics([KIK], 30, () => undefined);
    expect(kik?.message).toBe('Instrumento desconhecido "kik". Você quis dizer "kick"?');
    expect(kik?.actions?.map((action) => action.name)).toEqual(["Trocar por kick"]);
  });

  it("the block shows problems not ignored, errors before warnings, at most three", () => {
    expect(shownProblems([KIK, EMPTY, WARN], new Set([problemKey(EMPTY)]))).toEqual([KIK, WARN]);
    expect(shownProblems([WARN, KIK, EMPTY], new Set())).toEqual([KIK, EMPTY, WARN]);
    expect(shownProblems([WARN, KIK, KIK, KIK], new Set())).toEqual([KIK, KIK, KIK]);
    expect(shownProblems([WARN], new Set([problemKey(WARN)]))).toEqual([]);
  });

  it("a warning is a warning mark with its fix as the action", () => {
    const remove = { title: "Remove the earlier gain", titleKey: "fixRemoveEarlier" as const, titleArgs: ["gain"], changes: [{ from: 30, to: 40, insert: "" }], safe: true };
    const [warning] = toLintDiagnostics([{ ...WARN, fix: remove }], 60, () => undefined);
    expect(warning).toMatchObject({ from: 30, to: 40, severity: "warning", source: "DUPLICATE_MODIFIER" });
    expect(warning?.actions?.map((action) => action.name)).toEqual(["Remove the earlier gain"]);
  });
});
