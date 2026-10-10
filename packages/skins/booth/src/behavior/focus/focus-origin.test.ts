// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { trackFocusOrigin } from "./focus-origin";

const key = (value: string): Event => Object.assign(new Event("keydown"), { key: value });

describe("trackFocusOrigin", () => {
  it("is a pointer focus after a click, until a key moves focus", () => {
    const target = new EventTarget();
    const origin = trackFocusOrigin(target);
    expect(origin.isPointer()).toBe(false);
    target.dispatchEvent(new Event("pointerdown"));
    expect(origin.isPointer()).toBe(true);
    target.dispatchEvent(key(" "));
    target.dispatchEvent(key("1"));
    expect(origin.isPointer()).toBe(true);
    target.dispatchEvent(key("ArrowLeft"));
    expect(origin.isPointer()).toBe(false);
  });

  it("stops listening once detached", () => {
    const target = new EventTarget();
    const origin = trackFocusOrigin(target);
    origin.detach();
    target.dispatchEvent(new Event("pointerdown"));
    expect(origin.isPointer()).toBe(false);
  });
});
