// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { ParameterView } from "@untzel/presentation/view-model";
import { mixParts } from "./track-mix-group";
const parameter = (name: string): ParameterView => ({ name }) as ParameterView;
describe("mixParts", () => {
  it("gives the gain to the fader and keeps the others in order", () => {
    const parts = mixParts([parameter("pan"), parameter("gain"), parameter("send")]);
    expect(parts.gain?.name).toBe("gain");
    expect(parts.others.map((entry) => entry.name)).toEqual(["pan", "send"]);
  });
  it("has no fader when the instrument has no gain", () => {
    expect(mixParts([parameter("pan")]).gain).toBeUndefined();
  });
});
