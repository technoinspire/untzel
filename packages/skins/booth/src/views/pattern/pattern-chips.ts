// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element, reconcile, setAttributes, setPressed, setText } from "../dom";
import { icon } from "../icons";
import type { PatternIntents } from "@untzel/skin-contract";
import type { TrackView } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";
import { chipAction, patternChipsModel, type PatternChip } from "./pattern-chips-model";
import { createPatternPreview } from "./pattern-preview";

// "Patterns" of the track detail: the manifest's named patterns as
// chips. A tap makes the track play it in the music from the next bar, the text untouched;
// Use (or a second tap) writes it. Chips always sound, whatever "Preview sounds" says.

export interface PatternChips {
  readonly root: HTMLElement;
  update(track: TrackView): void;
}

// Over 40 lines: one chip row and its preview box built and updated, nothing else.
export function createPatternChips(intents: PatternIntents): PatternChips {
  let current: TrackView | null = null;
  const list = element("div", { className: "ui-patterns__chips", attributes: { role: "group" } });
  const caption = element("p", { className: "ui-patterns__caption" });
  const preview = createPatternPreview({
    onUse: (pattern) => current !== null && intents.usePattern(current.name, pattern),
    onCancel: () => intents.endTrackPreview(),
  });
  const root = element("div", { className: "ui-patterns" }, [
    element("p", { className: "ui-detail__label", text: text.patterns }),
    list,
    caption,
    preview.root,
  ]);
  const chips = new Map<string, HTMLButtonElement>();
  const onChip = (name: string): void => {
    if (current === null) return;
    const action = chipAction(patternChipsModel(current), name);
    if (action === "preview") intents.previewPattern(current.name, name);
    else if (action === "use") intents.usePattern(current.name, name);
  };
  const create = (chip: PatternChip): HTMLButtonElement => {
    const node = element("button", { className: "ui-pill ui-pill--chip ui-patterns__chip", attributes: { type: "button" } }, [
      icon("check"),
      icon("speaker"),
      element("span", { text: chip.name }),
    ]);
    node.addEventListener("click", () => onChip(chip.name));
    return node;
  };
  const update = (node: HTMLButtonElement, chip: PatternChip): void => {
    setPressed(node, chip.isCurrent);
    node.dataset["previewing"] = String(chip.isPreviewing);
    setAttributes(node, { "aria-label": chip.isPreviewing ? strings.previewingChip(chip.name) : chip.name });
  };

  return {
    root,
    update(track) {
      current = track;
      const model = patternChipsModel(track);
      root.hidden = model.chips.length === 0;
      list.setAttribute("aria-label", model.label);
      reconcile(list, model.chips, (chip) => chip.name, create, update, chips);
      caption.hidden = model.caption === null;
      setText(caption, model.caption ?? "");
      preview.update(model.preview, track.previewing);
    },
  };
}
