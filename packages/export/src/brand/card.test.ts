// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { CARD_FADE_FRAMES, LOGO_RECT, URL_RECT, cardFadeAlpha } from "./card";

describe("closing card", () => {
  it("fades in over 300 ms with an exponential ease-out, whole on its ninth frame", () => {
    expect(CARD_FADE_FRAMES).toBe(9);
    const alphas = Array.from({ length: CARD_FADE_FRAMES }, (_, frame) => cardFadeAlpha(frame, false));
    expect(alphas.every((alpha, index) => index === 0 || alpha > (alphas[index - 1] ?? 0))).toBe(true);
    expect(alphas[0]).toBeGreaterThan(0.5);
    expect(alphas.at(-1)).toBe(1);
    expect(cardFadeAlpha(30, false)).toBe(1);
  });

  it("appears at once with reduced motion", () => {
    expect(cardFadeAlpha(0, true)).toBe(1);
  });

  it("stacks the logo and the URL with at least 100 px of air", () => {
    expect(URL_RECT.y - (LOGO_RECT.y + LOGO_RECT.h)).toBeGreaterThanOrEqual(100);
  });
});
