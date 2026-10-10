// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Program } from "@untzel/core";
import { analyze } from "@untzel/language";
import { describe, expect, it } from "vitest";
import { simRegistry } from "@untzel/sim/registry";
import { isSameProgram } from "./program-equality";

const { registry } = simRegistry();

function program(source: string): Program {
  const result = analyze(source, registry);
  if (!result.ok) throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join("; "));
  return result.program;
}

describe("isSameProgram", () => {
  it("ignores spacing, comments and how hits are split into words", () => {
    expect(isSameProgram(program("kick: kick x... x... | drive 0.3"), program("// intro\nkick:kick   x...x...|drive 0.30"))).toBe(true);
  });

  it("ignores the order of track lines", () => {
    expect(isSameProgram(program("kick x...\nhat ..x."), program("hat ..x.\nkick x..."))).toBe(true);
  });

  it("sees lone hits and a hits word as the same steps", () => {
    expect(isSameProgram(program("hat x.x. x.x."), program("hat x . x . x.x."))).toBe(true);
  });

  it("tells apart a different step, value, member or song", () => {
    const base = "kick x...\nhat ..x.\nsection a kick hat\nsong a 4";
    expect(isSameProgram(program(base), program(base.replace("..x.", "..xx")))).toBe(false);
    expect(isSameProgram(program(base), program(base.replace("kick x...", "kick x... | drive 0.4")))).toBe(false);
    expect(isSameProgram(program(base), program(base.replace("a kick hat", "a kick")))).toBe(false);
    expect(isSameProgram(program(base), program(base.replace("a 4", "a 8")))).toBe(false);
  });
});
