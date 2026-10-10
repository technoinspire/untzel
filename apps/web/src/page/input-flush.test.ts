// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { drawBeforeInput } from "./input-flush";

describe("drawBeforeInput", () => {
  it("draws before every discrete input, in the capture phase", () => {
    const added: { type: string; capture: boolean }[] = [];
    let draws = 0;
    const listeners: (() => void)[] = [];
    drawBeforeInput(
      {
        addEventListener: (type: string, listener: unknown, options?: unknown) => {
          added.push({ type, capture: (options as AddEventListenerOptions).capture === true });
          listeners.push(listener as () => void);
        },
      },
      () => (draws += 1),
    );
    expect(added.map((entry) => entry.type)).toEqual(["keydown", "keyup", "pointerdown", "pointerup", "click"]);
    expect(added.every((entry) => entry.capture)).toBe(true);
    for (const listener of listeners) listener();
    expect(draws).toBe(5);
  });

  it("does not draw on input or change, so a pending frame cannot undo a pick", () => {
    const select = { value: "16" };
    const target = new EventTarget();
    const model = { bars: "16" };
    drawBeforeInput(target as unknown as Pick<Window, "addEventListener">, () => (select.value = model.bars));
    let picked = "";
    target.addEventListener("change", () => (picked = select.value));
    select.value = "8";
    target.dispatchEvent(new Event("change"));
    expect(picked).toBe("8");
  });
});
