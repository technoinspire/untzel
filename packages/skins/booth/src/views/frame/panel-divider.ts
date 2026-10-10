// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element, setAttributes } from "../dom";
import { PANEL_STEP_PX } from "../../behavior/preferences/panel-width";
import { strings, text } from "../../copy/copy";

// The divider between the stage and the Code panel on the desktop:
// a focusable vertical separator on the panel's left edge. Dragging or the arrows
// ask for a width (16 px a press, Left widens), Home and End go to the bounds, a double
// click asks for the default. A view: a width and its bounds in, wanted widths out.

export interface PanelDividerModel {
  readonly width: number;
  readonly min: number;
  readonly max: number;
}

export interface PanelDividerIntents {
  resize(width: number): void;
  reset(): void;
}

export interface PanelDivider {
  readonly root: HTMLElement;
  update(model: PanelDividerModel): void;
}

/** The width an arrow key asks for; null for a key the divider does not use. */
export function widthForKey(key: string, model: PanelDividerModel): number | null {
  switch (key) {
    case "ArrowLeft":
      return model.width + PANEL_STEP_PX;
    case "ArrowRight":
      return model.width - PANEL_STEP_PX;
    case "Home":
      return model.min;
    case "End":
      return model.max;
    default:
      return null;
  }
}

// Over 40 lines: one divider and its drag; the widths come from widthForKey and panel-width.ts.
export function createPanelDivider(intents: PanelDividerIntents): PanelDivider {
  const root = element("div", {
    className: "ui-panel__divider",
    attributes: { role: "separator", tabindex: 0, "aria-orientation": "vertical", "aria-label": text.resizeCode },
  });
  let model: PanelDividerModel = { width: 0, min: 0, max: 0 };

  root.addEventListener("keydown", (event) => {
    const wanted = widthForKey(event.key, model);
    if (wanted === null) return;
    event.preventDefault();
    intents.resize(wanted);
  });
  root.addEventListener("dblclick", () => intents.reset());
  root.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    root.setPointerCapture(event.pointerId);
    // The panel sits on the right: its width is its right edge minus the pointer.
    const right = root.parentElement?.getBoundingClientRect().right ?? window.innerWidth;
    const move = (moved: PointerEvent): void => intents.resize(right - moved.clientX);
    const end = (): void => {
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", end);
      root.removeEventListener("pointercancel", end);
      delete root.dataset["dragging"];
    };
    root.dataset["dragging"] = "true";
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", end);
    root.addEventListener("pointercancel", end);
  });

  return {
    root,
    update(next) {
      model = next;
      setAttributes(root, {
        "aria-valuenow": next.width,
        "aria-valuemin": next.min,
        "aria-valuemax": next.max,
        "aria-valuetext": strings.codeWidth(next.width),
      });
    },
  };
}
