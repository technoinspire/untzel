// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The booth's entries satisfy the skin contract. The check is the type
// of the two functions below: an entry that drops a member the contract asks for fails tsc.
import { describe, expect, it } from "vitest";
import type { SkinEntry, SkinPortugueseEntry } from "@untzel/skin-contract";
import type { ControlsTranslations } from "./copy/copy";
import { controlsPortuguese } from "./copy/portuguese";
type BoothEntry = typeof import("./index");
type BoothPortugueseEntry = typeof import("./copy/portuguese");
const asSkinEntry = (entry: BoothEntry): SkinEntry<ControlsTranslations> => entry;
const asPortugueseEntry = (entry: BoothPortugueseEntry): SkinPortugueseEntry<ControlsTranslations> => entry;
describe("the booth entries", () => {
  it("satisfy SkinEntry and SkinPortugueseEntry", () => {
    expect(asPortugueseEntry({ controlsPortuguese } as BoothPortugueseEntry).controlsPortuguese).toBe(controlsPortuguese);
    expect(typeof asSkinEntry).toBe("function");
  });
});
