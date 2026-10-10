// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setAttributes, setPressed, setText } from "../dom";
import type { ExportIntents } from "@untzel/skin-contract";
import type { ExportFormat, UntzelView } from "@untzel/presentation/view-model";
import { exportLabels, text } from "../../copy/copy";
import { exportAspects } from "../../copy/strings";

const FORMATS: readonly ExportFormat[] = ["story", "video", "audio"];

export interface FormatOptionState {
  readonly isPressed: boolean;
  /** No video codec: only Audio acts. */
  readonly isDisabled: boolean;
  /** "0:15 + 2 s", "0:29 · WAV". */
  readonly detail: string;
}

/** What one format button shows for this export state. */
export function formatOptionState(format: ExportFormat, state: UntzelView["export"]): FormatOptionState {
  return {
    isPressed: format === state.format,
    isDisabled: state.isVideoUnavailable && format !== "audio",
    detail: state.durations[format],
  };
}

/** Story, Video and Audio, each with its aspect and its length. */
export function createExportFormats(intents: Pick<ExportIntents, "selectExportFormat">): { readonly root: HTMLElement; update(state: UntzelView["export"]): void } {
  const options = FORMATS.map((format) => formatOption(format, () => intents.selectExportFormat(format)));
  return {
    root: element("div", { className: "ui-export__options", attributes: { role: "group", "aria-label": text.format } }, options),
    update(state) {
      for (const node of options) {
        const option = formatOptionState(node.dataset["format"] as ExportFormat, state);
        setPressed(node, option.isPressed);
        setAttributes(node, { "aria-disabled": option.isDisabled ? "true" : null });
        const detail = node.querySelector(".ui-option__detail");
        if (detail !== null) setText(detail, option.detail);
      }
    },
  };
}

function formatOption(format: ExportFormat, onSelect: () => void): HTMLButtonElement {
  const node = button("ui-option", exportLabels[format], onSelect, [
    element("span", { className: "ui-option__name" }, [
      element("span", { text: () => exportLabels[format] }),
      element("span", { className: "ui-option__aspect", text: ` ${exportAspects[format]}` }),
    ]),
    element("span", { className: "ui-option__detail" }),
  ]);
  node.removeAttribute("aria-label");
  node.dataset["format"] = format;
  return node;
}
