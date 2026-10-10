// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setText } from "../dom";
import { icon } from "../icons";
import { text } from "../../copy/copy";
import type { PatternPreviewBox } from "./pattern-chips-model";

// The box under the chips while a pattern previews: "Previewing Broken", what it means,
// Cancel and Use Broken. Dumb: the words come from pattern-chips-model.ts.

export interface PatternPreviewCallbacks {
  readonly onUse: (pattern: string) => void;
  readonly onCancel: () => void;
}

export interface PatternPreview {
  readonly root: HTMLElement;
  update(box: PatternPreviewBox | null, pattern: string | null): void;
}

export function createPatternPreview(callbacks: PatternPreviewCallbacks): PatternPreview {
  let pattern: string | null = null;
  // The status region holds the message only and never hides: a region that
  // shows with its text may go unannounced, and it once held "Cancel" too. The drawn
  // title and note say the same, so they are hidden from the accessibility tree.
  const status = element("p", { className: "ui-visually-hidden", attributes: { role: "status" } });
  const title = element("p", { className: "ui-patterns__preview-title", attributes: { "aria-hidden": "true" } });
  const note = element("p", { className: "ui-patterns__preview-note", attributes: { "aria-hidden": "true" } });
  const cancel = button("ui-pill ui-pill--raised", text.cancel, () => callbacks.onCancel());
  const use = button("ui-pill ui-pill--primary", "", () => {
    if (pattern !== null) callbacks.onUse(pattern);
  });
  const box = element("div", { className: "ui-patterns__preview" }, [
    element("div", { className: "ui-patterns__preview-head" }, [icon("speaker"), title]),
    note,
    element("div", { className: "ui-patterns__preview-actions" }, [cancel, use]),
  ]);
  const root = element("div", { className: "ui-slot" }, [status, box]);

  return {
    root,
    update(next, previewing) {
      pattern = previewing;
      box.hidden = next === null;
      setText(status, next?.announcement ?? "");
      setText(title, next?.title ?? "");
      setText(note, next?.note ?? "");
      setText(use, next?.useLabel ?? "");
    },
  };
}
