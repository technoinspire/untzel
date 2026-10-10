// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's quality: HD and 4K, each with its resolution in the chosen
// format and the measured time to render. Before the first probe both show at once, HD
// chosen, with a line saying Render checks the device first;
// after it, 4K only where this device's probe passed.
// Emits selectExportQuality; holds no state of its own.
import { button, element, setPressed, setText } from "../dom";
import type { ExportIntents } from "@untzel/skin-contract";
import type { ExportQualityName, ExportQualityOption, ExportView } from "@untzel/presentation/view-model";
import { text } from "../../copy/copy";
import { qualityLabels } from "../../copy/strings";
import type { ExportSheetModel } from "./export-sheet-model";

export interface ExportQualityControls {
  readonly root: HTMLElement;
  update(state: ExportView, model: ExportSheetModel): void;
}

/** "1080 × 1920 · about 6 s to render", or the resolution alone before the probe. */
export function qualityDetail(option: ExportQualityOption): string {
  return option.estimate === null ? option.resolution : `${option.resolution} · ${option.estimate}`;
}

export function createExportQuality(intents: Pick<ExportIntents, "selectExportQuality">): ExportQualityControls {
  const options = new Map<ExportQualityName, HTMLButtonElement>();
  const group = element("div", { className: "ui-export__qualities", attributes: { role: "group", "aria-label": text.quality } });
  const note = element("p", { className: "ui-export__note" });
  const root = element("div", { className: "ui-export__quality" }, [
    element("p", { className: "ui-export__label", text: text.quality, attributes: { "aria-hidden": "true" } }),
    group,
    note,
  ]);
  return {
    root,
    update(state, model) {
      root.hidden = !model.isQualityShown;
      const offered = new Set(state.qualities.map((option) => option.quality));
      for (const [quality, node] of options) {
        if (!offered.has(quality)) {
          node.remove();
          options.delete(quality);
        }
      }
      for (const option of state.qualities) {
        const node = options.get(option.quality) ?? created(option.quality, intents, group, options);
        setPressed(node, option.quality === state.quality);
        const detail = node.querySelector(".ui-option__detail");
        if (detail !== null) setText(detail, qualityDetail(option));
      }
      setText(note, state.qualityNote ?? "");
      note.hidden = state.qualityNote === null;
    },
  };
}

function created(
  quality: ExportQualityName,
  intents: Pick<ExportIntents, "selectExportQuality">,
  group: HTMLElement,
  options: Map<ExportQualityName, HTMLButtonElement>,
): HTMLButtonElement {
  const node = button("ui-option ui-option--quality", qualityLabels[quality], () => intents.selectExportQuality(quality), [
    element("span", { className: "ui-option__name", text: qualityLabels[quality] }),
    element("span", { className: "ui-option__detail" }),
  ]);
  node.removeAttribute("aria-label");
  node.dataset["quality"] = quality;
  group.append(node);
  options.set(quality, node);
  return node;
}
