// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The text rules of template identity: pure checks on synthetic kits,
// then the same checks on the real template library (analysis only, no WASM).
import { fileURLToPath } from "node:url";
import { analyze } from "@untzel/language";
import { describe, expect, it } from "vitest";
import { simRegistry } from "../registry";
import { templateKits } from "./template-identity";
import { kickSource } from "./template-kicks";
import { kitOf, reportSignatureViolations, sharedDrumViolations, signatureSources, uniqueSourceViolations, type TemplateKit } from "./template-kit";
import { TEMPLATE_SHARED_DRUMS_MAX, TEMPLATE_SIGNATURES } from "../timbre/timbre-targets";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));

const kit = (template: string, drums: string[], sources: string[]): TemplateKit => ({ template, drums, sources, kick: null });

describe("template kit rules", () => {
  it("flags a pair that shares more drum sounds than allowed, and names them", () => {
    const kits = [kit("a", ["hat closed", "hat open", "kick punch"], ["hat closed", "kick punch"]), kit("b", ["hat closed", "hat open", "kick punch"], ["hat closed", "kick punch"])];
    const [violation] = sharedDrumViolations(kits, 2);
    expect(violation?.message).toContain("share 3 drum sounds");
    expect(sharedDrumViolations(kits, 3)).toEqual([]);
  });

  it("asks every template for a sound no other plays: another preset of a shared instrument counts", () => {
    const kits = [kit("a", [], ["kick punch", "organ perc"]), kit("b", [], ["kick punch", "pad warm"]), kit("c", [], ["kick punch", "pad warm"]), kit("d", [], ["kick punch", "organ soft"])];
    expect(uniqueSourceViolations(kits).map((violation) => violation.message)).toEqual(["b has no sound that no other template plays", "c has no sound that no other template plays"]);
    expect(signatureSources(kits[0]!, kits)).toEqual(["organ perc"]);
  });
  it("keeps the signatures the report gives a template, by sound or by instrument", () => {
    const kits = [kit("a", [], ["piano felt", "vox ooh"]), kit("b", [], ["piano grand"])];
    const signatures = { a: ["piano felt", "vox"], b: ["piano felt", "supersaw"] };
    expect(reportSignatureViolations(kits, signatures).map((violation) => violation.message)).toEqual(["b lost its report (e) signature piano felt", "b lost its report (e) signature supersaw"]);
  });

  it("reads the drums, the sources and the kick line from a program", () => {
    const { registry } = simRegistry();
    const result = analyze("tempo 120\nkey c minor\nk: kick boom x... | decay 1 | gain 0.8\nh: hat x.x.\np: pad warm Cm ~ ~ ~\n", registry);
    if (!result.ok) throw new Error("does not analyze");
    const read = kitOf("t", result.program, registry);
    expect(read.drums).toEqual(["hat closed", "kick boom"]);
    expect(read.sources).toEqual(["hat closed", "kick boom", "pad warm"]);
    expect(read.kick).toBe("kick boom | decay 1");
    expect(kickSource(read.kick!)).toBe("tempo 120\nkey c minor\nvoice: kick boom x... / .... / .... | decay 1\n");
  });
});

describe("the template library", () => {
  const kits = templateKits(REPO);

  it("keeps at most two shared drum sounds per pair, a sound of its own per template and the (e) signatures", () => {
    expect(kits.length).toBeGreaterThanOrEqual(13);
    expect(sharedDrumViolations(kits, TEMPLATE_SHARED_DRUMS_MAX).map((violation) => violation.message)).toEqual([]);
    expect(uniqueSourceViolations(kits).map((violation) => violation.message)).toEqual([]);
    expect(reportSignatureViolations(kits, TEMPLATE_SIGNATURES).map((violation) => violation.message)).toEqual([]);
  });

  it("gives every template its own kick sound word", () => {
    const kicks = kits.map((entry) => entry.kick?.split(" | ")[0] ?? "");
    expect(kicks.every((line) => line.startsWith("kick "))).toBe(true);
  });

  it("names a signature only for templates that exist", () => {
    const ids = new Set(kits.map((entry) => entry.template));
    for (const id of Object.keys(TEMPLATE_SIGNATURES)) expect(ids.has(id), id).toBe(true);
  });
});
