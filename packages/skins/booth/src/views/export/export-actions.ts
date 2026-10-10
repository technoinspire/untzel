// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setText } from "../dom";
import type { ExportIntents } from "@untzel/skin-contract";
import type { ExportView } from "@untzel/presentation/view-model";
import { text } from "../../copy/copy";
import { nextExportFocus, type ExportAction, type ExportSheetModel } from "./export-sheet-model";

export interface ExportActions {
  /** The failure's message and Try again. */
  readonly failure: HTMLElement;
  /** Render, Download, Share and Cancel. */
  readonly row: HTMLElement;
  update(state: ExportView, model: ExportSheetModel): void;
}

/** What the sheet offers for its status; a focused action that hides hands the focus on. */
export function createExportActions(intents: ExportIntents): ExportActions {
  const message = element("p", { className: "ui-export__message", attributes: { role: "alert" } });
  const retry = button("ui-pill ui-pill--outline ui-export__retry", text.tryAgain, () => intents.renderExport());
  const render = button("ui-pill ui-pill--primary ui-export__render", text.render, () => intents.renderExport());
  const share = button("ui-pill ui-pill--outline ui-export__action", text.share, () => intents.shareExport());
  const download = button("ui-pill ui-pill--primary ui-export__action", text.download, () => intents.downloadExport());
  const cancel = button("ui-pill ui-pill--outline ui-export__cancel", text.cancel, () => intents.cancelExport());
  const actions: Readonly<Record<ExportAction, HTMLButtonElement>> = { cancel, download, retry, render };
  return {
    failure: element("div", { className: "ui-export__failure" }, [message, retry]),
    row: element("div", { className: "ui-export__actions" }, [render, download, share, cancel]),
    update(state, model) {
      // The alert never hides: a region that shows with its text may go
      // unannounced, so only the text comes and goes.
      setText(message, model.isFailureShown ? (state.message ?? "") : "");
      const focused = [render, download, share, cancel, retry].find((node) => node === document.activeElement);
      retry.hidden = !model.isRetryShown;
      cancel.hidden = !model.isCancelShown;
      render.hidden = !model.isRenderShown;
      share.hidden = !model.isShareShown;
      download.hidden = !model.isDownloadShown;
      const next = focused?.hidden === true ? nextExportFocus(model) : null;
      if (next !== null) actions[next].focus({ preventScroll: true });
    },
  };
}
