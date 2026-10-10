// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's stretch in the sheet: the transport's range
// ruler, reused, over the loop or the song, with the handles moving by steps; the start
// and the end as time and bar.beat; Fine (1/64); "Use play range"; and the format's cap
// under it; Listen plays the stretch. Emits setExportStretch, setExportFine,
// useExportPlayRange and toggleExportListen; holds nothing.
import { button, element, setAttributes, setPressed, setText } from "../dom";
import { icon } from "../icons";
import type { ExportStretchIntents } from "@untzel/skin-contract";
import type { ExportFormat, ExportQualityName, ExportStretchView } from "@untzel/presentation/view-model";
import { exportStretchStrings, exportStretchText, rangeStrings } from "../../copy/copy";
import { exportRulerView, exportScale, exportStretchState, stretchTicksOf } from "./export-stretch-model";
import { createRangeRuler } from "../range/range-ruler";

export interface ExportStretchControls {
  readonly root: HTMLElement;
  update(view: ExportStretchView, format: ExportFormat, quality: ExportQualityName): void;
}

// Over 40 lines: one stretch ruler built and updated, nothing else.
export function createExportStretch(intents: ExportStretchIntents): ExportStretchControls {
  const ruler = createRangeRuler(exportStretchText.ruler, {
    onEdges: (edges, gesture) => {
      const ticks = stretchTicksOf(edges);
      intents.setExportStretch(ticks.start, ticks.end, gesture);
    },
    // A tap is not a gesture of this ruler: the handles and the keys move the stretch.
    onTap: () => undefined,
  });
  const selected = element("p", { className: "ui-export__selected" });
  const readout = element("p", { className: "ui-export__readout" });
  let isFine = false;
  const fineState = element("span", { className: "ui-range-row__cycle-state", attributes: { "aria-hidden": "true" } });
  const fine = button("ui-switch ui-export__fine", exportStretchText.fine, () => intents.setExportFine(!isFine), [
    element("span", { text: exportStretchText.fine, attributes: { "aria-hidden": "true" } }),
    element("span", { className: "ui-switch__track", attributes: { "aria-hidden": "true" } }),
    fineState,
  ]);
  setAttributes(fine, { role: "switch", title: exportStretchText.fineHint });
  const reset = button("ui-pill ui-pill--raised ui-export__reset", exportStretchText.usePlayRange, () => {
    if (reset.getAttribute("aria-disabled") !== "true") intents.useExportPlayRange();
  });
  const cap = element("p", { className: "ui-export__cap" });
  const listenLabel = element("span", { text: exportStretchText.listen });
  const listenIcon = element("span", { className: "ui-export__listen-icon", attributes: { "aria-hidden": "true" } }, [icon("play")]);
  const listen = button("ui-pill ui-pill--outline ui-export__listen", exportStretchText.listen, () => intents.toggleExportListen(), [listenIcon, listenLabel]);
  listen.removeAttribute("aria-label");
  setAttributes(listen, { title: exportStretchText.listenHint });
  const actions = element("div", { className: "ui-export__stretch-actions" }, [listen, fine, reset]);
  const root = element("div", { className: "ui-export__stretch" }, [selected, ruler.root, readout, cap, actions]);
  return {
    root,
    update(view, format, quality) {
      selected.hidden = view.playRangeLabel === null;
      setText(selected, view.playRangeLabel ?? "");
      ruler.update(exportRulerView(view), exportScale(view));
      const state = exportStretchState(view, format, quality);
      setText(readout, state.readout);
      setText(cap, state.capNote);
      isFine = view.isFine;
      fine.setAttribute("aria-checked", String(view.isFine));
      setText(fineState, view.isFine ? rangeStrings.on : rangeStrings.off);
      setPressed(listen, view.isListening);
      setText(listenLabel, view.isListening ? exportStretchStrings.stopListening : exportStretchStrings.listen);
      listenIcon.replaceChildren(icon(view.isListening ? "stop" : "play"));
      reset.textContent = state.resetLabel;
      setAttributes(reset, { "aria-label": null, "aria-disabled": state.isResetInert ? "true" : null });
    },
  };
}
