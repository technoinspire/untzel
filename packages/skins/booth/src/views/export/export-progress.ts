// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element, setText, setVar } from "../dom";
import type { ExportView } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";
import type { ExportSheetModel } from "./export-sheet-model";

/** "About 12 s left" while a render runs; nothing before the first estimate. */
export function timeLeftText(secondsLeft: number | null): string {
  return secondsLeft === null ? "" : strings.secondsLeft(secondsLeft);
}

export interface ExportProgress {
  /** The status and its origin, on one row. */
  readonly row: HTMLElement;
  readonly meter: HTMLElement;
  readonly left: HTMLElement;
  update(state: ExportView, model: ExportSheetModel): void;
  setTimeLeft(state: ExportView, model: ExportSheetModel): void;
}

/**
 * The render's status, where the music comes from, its progress and the time left. Its own
 * meter, not the transport's (cpu-meter.ts): this sheet is a lazy chunk, and sharing the
 * module would add a chunk to the first screen (the chunk rule).
 */
export function createExportProgress(): ExportProgress {
  const status = element("p", { className: "ui-export__status" });
  const origin = element("p", { className: "ui-export__origin" });
  const left = element("p", { className: "ui-export__left" });
  const meter = element("span", { className: "ui-meter ui-export__progress", attributes: { role: "progressbar", "aria-label": text.renderProgress, "aria-valuemin": 0, "aria-valuemax": 100 } }, [
    element("span", { className: "ui-meter__fill" }),
  ]);
  return {
    row: element("div", { className: "ui-export__row" }, [status, origin]),
    meter,
    left,
    update(state, model) {
      setText(status, model.statusText);
      status.hidden = !model.isStatusShown;
      setText(origin, state.origin);
      setVar(meter, "--fill", model.progress);
      meter.setAttribute("aria-valuenow", String(model.percent));
      meter.hidden = !model.isMeterShown;
    },
    setTimeLeft(state, model) {
      left.hidden = !model.isTimeLeftShown;
      setText(left, timeLeftText(state.secondsLeft));
    },
  };
}
