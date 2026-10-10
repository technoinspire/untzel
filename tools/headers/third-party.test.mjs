// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { attributionProblems, thirdPartySections } from "./third-party.mjs";

const MARKDOWN = "# Third-party code\n\n## Mutable Instruments Rings\n\n- packages/dsp/src/engines/modal.rs\n\n## STK\n\n- none yet\n";

describe("third-party attribution", () => {
  const sections = thirdPartySections(MARKDOWN);

  it("reads one section per project", () => {
    expect([...sections.keys()]).toEqual(["Mutable Instruments Rings", "STK"]);
  });

  it("passes a file that derives nothing, and a listed derived file", () => {
    expect(attributionProblems("a.rs", "// plain code\n", sections)).toEqual([]);
    const text = "// Portions derived from Mutable Instruments Rings (MIT), see THIRD_PARTY.md\n";
    expect(attributionProblems("packages/dsp/src/engines/modal.rs", text, sections)).toEqual([]);
  });

  it("fails a project without a section and a file missing from its section", () => {
    const unknown = "// Portions derived from Plaits (MIT), see THIRD_PARTY.md\n";
    expect(attributionProblems("b.rs", unknown, sections)[0]).toContain("no section");
    const unlisted = "// Portions derived from STK (MIT-STK), see THIRD_PARTY.md\n";
    expect(attributionProblems("c.rs", unlisted, sections)[0]).toContain("not listed");
  });
});
