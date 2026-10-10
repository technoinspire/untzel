// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import type { InstrumentManifest } from "../manifest/manifest-types";
import { toneOverriddenBy, type WrittenParameter } from "./tone-override";

function manifestWithTone(...parameters: readonly string[]): InstrumentManifest {
  return { tone: parameters.map((parameter) => ({ parameter, from: 0, to: 1 })) } as unknown as InstrumentManifest;
}

function written(name: string, explicit = true, isSignal = false): WrittenParameter {
  return { name, explicit, isSignal };
}

describe("toneOverriddenBy", () => {
  it("names open on the ride when the text writes it", () => {
    expect(toneOverriddenBy(manifestWithTone("open"), [written("open")])).toEqual([{ parameter: "open", isSignal: false }]);
  });

  it("names cutoff on the bass, also when a signal drives it", () => {
    expect(toneOverriddenBy(manifestWithTone("cutoff"), [written("cutoff", true, true)])).toEqual([{ parameter: "cutoff", isSignal: true }]);
  });

  it("is empty when the parameter only has its default (not written)", () => {
    expect(toneOverriddenBy(manifestWithTone("cutoff"), [written("cutoff", false), written("decay")])).toEqual([]);
  });

  it("lists every written parameter of a mapping that moves several, in mapping order", () => {
    const manifest = manifestWithTone("cutoff", "open");
    expect(toneOverriddenBy(manifest, [written("open"), written("cutoff")]).map((entry) => entry.parameter)).toEqual(["cutoff", "open"]);
  });

  it("is empty for a manifest without a tone mapping", () => {
    expect(toneOverriddenBy(manifestWithTone(), [written("open")])).toEqual([]);
  });
});
