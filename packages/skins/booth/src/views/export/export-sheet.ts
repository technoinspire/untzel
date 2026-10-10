// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export sheet: format, range, quality, preview, progress, and the finished file to download
// or share. Opening it does no work: Render starts the job. What shows for each
// status comes from exportSheetModel; this file only applies it.
import { element } from "../dom";
import type { ExportIntents } from "@untzel/skin-contract";
import type { UntzelView } from "@untzel/presentation/view-model";
import { text } from "../../copy/copy";
import { createExportActions } from "./export-actions";
import { createExportFormats } from "./export-formats";
import { createExportPreview } from "./export-preview";
import { createExportProgress } from "./export-progress";
import { createExportQuality } from "./export-quality";
import { createExportRange } from "./export-range";
import { exportSheetModel } from "./export-sheet-model";
import { createSheet, type Sheet } from "../sheets/sheet";

export interface ExportSheet extends Sheet {
  update(view: UntzelView): void;
}

// Over 40 lines: one sheet built and updated in the order its parts were always drawn.
export function createExportSheet(intents: ExportIntents, logoUrl: string, onClose: () => void): ExportSheet {
  const sheet = createSheet({ id: "ui-export", title: text.export, className: "ui-sheet--export", onClose });
  const formats = createExportFormats(intents);
  const range = createExportRange(intents);
  const quality = createExportQuality(intents);
  const preview = createExportPreview(logoUrl);
  const progress = createExportProgress();
  const actions = createExportActions(intents);
  const hint = element("p", { className: "ui-sheet__hint", text: text.musicKeepsPlaying });
  const soloNotice = element("p", { className: "ui-export__solo", text: text.exportSoloNotice });
  sheet.body.append(
    formats.root,
    range.root,
    quality.root,
    preview.root,
    progress.row,
    progress.meter,
    progress.left,
    actions.failure,
    hint,
    soloNotice,
    actions.row,
  );

  return {
    ...sheet,
    update(view) {
      const state = view.export;
      const model = exportSheetModel(state);
      sheet.root.dataset["format"] = state.format;
      sheet.root.dataset["status"] = state.status;
      formats.update(state);
      range.update(state, model);
      quality.update(state, model);
      preview.update(state, model);
      progress.update(state, model);
      hint.hidden = !model.isHintShown;
      soloNotice.hidden = !model.isSoloNoticeShown;
      progress.setTimeLeft(state, model);
      actions.update(state, model);
    },
  };
}
