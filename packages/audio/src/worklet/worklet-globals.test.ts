// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// These globals do not exist in AudioWorkletGlobalScope (measured in Chrome and
// Firefox), although @types/audioworklet declares some of them.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const workletDir = dirname(fileURLToPath(import.meta.url));
const forbidden = /\b(TextDecoder|TextEncoder|performance)\b/;

describe("worklet source", () => {
  it("uses no global missing from AudioWorkletGlobalScope", () => {
    const offenders = readdirSync(workletDir)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .filter((file) => forbidden.test(readFileSync(join(workletDir, file), "utf8")));
    expect(offenders).toEqual([]);
  });
});
