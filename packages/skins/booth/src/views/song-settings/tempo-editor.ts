// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setAttributes, setText, setVar } from "../dom";
import { icon } from "../icons";
import type { StatementIntents } from "@untzel/skin-contract";
import type { TransportView } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";
import { TOP_BAR_PX, popoverPosition } from "../primitives/popover-position";
import { createSheet, type Sheet } from "../sheets/sheet";
import { createTapTempo } from "./tap-tempo";
import { MAX_BPM, MIN_BPM, fieldKeySteps, parseTempo, steppedTempo, tempoEditorModel } from "./tempo-editor-model";
import { createTempoStepper } from "./tempo-stepper";

// The tempo editor the BPM of the transport opens: −, a number field, +
// and Tap tempo. A bottom sheet on the phone, a popover by the BPM on the desktop, like
// the Length picker. The new tempo enters on the next bar; the music never stops.

export interface TempoEditor extends Sheet {
  update(transport: TransportView): void;
  anchor(rect: DOMRect | null): void;
}

// Over 40 lines: one editor built and updated; its stepper and Tap tempo are their own views.
export function createTempoEditor(intents: StatementIntents, onClose: () => void): TempoEditor {
  const sheet = createSheet({ id: "ui-tempo", title: strings.tempo, className: "ui-sheet--popover ui-sheet--tempo", onClose });
  let current = 0;
  const link = element("p", { className: "ui-tempo__link" });
  const field = element("input", {
    className: "ui-tempo__field",
    attributes: { type: "text", inputmode: "decimal", role: "spinbutton", "aria-label": "BPM", "aria-valuemin": MIN_BPM, "aria-valuemax": MAX_BPM, autocomplete: "off", "aria-describedby": "ui-tempo-message" },
  });
  const message = element("p", { className: "ui-tempo__message", attributes: { id: "ui-tempo-message" } });
  const write = (bpm: number): void => {
    current = bpm;
    field.value = String(bpm);
    intents.setTempo(bpm);
  };
  const apply = (): void => {
    const entry = parseTempo(field.value, current);
    field.classList.toggle("is-error", entry.kind === "error");
    setAttributes(field, { "aria-invalid": entry.kind === "error" ? "true" : null });
    if (entry.kind === "error") setText(message, entry.message);
    if (entry.kind === "ok") write(entry.bpm);
  };
  const tap = createTapTempo(write);
  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") apply();
    const steps = fieldKeySteps(event.key, event.shiftKey);
    if (steps !== null) {
      event.preventDefault();
      write(steppedTempo(current, steps));
    }
  });
  field.addEventListener("blur", apply);
  sheet.root.addEventListener("keydown", (event) => {
    if ((event.key === "t" || event.key === "T") && event.target !== field) tap.tap(event.timeStamp);
  });
  sheet.body.append(
    link,
    element("div", { className: "ui-tempo__row" }, [
      createTempoStepper(text.slower, "minus", () => write(steppedTempo(current, -1))),
      field,
      createTempoStepper(text.faster, "plus", () => write(steppedTempo(current, 1))),
    ]),
    tap.root,
    message,
  );

  return {
    ...sheet,
    update(transport) {
      const model = tempoEditorModel({ sounding: transport.bpm, songTempo: transport.songTempo, setBy: transport.tempoSetBy });
      current = transport.songTempo;
      setText(sheet.heading, model.title);
      sheet.root.setAttribute("aria-label", model.title);
      link.hidden = model.link === null;
      link.replaceChildren(icon("link"), element("span", { text: model.link ?? "" }));
      if (document.activeElement !== field) field.value = model.field;
      setAttributes(field, { "aria-valuenow": transport.songTempo });
      if (!field.classList.contains("is-error")) setText(message, model.note);
    },
    anchor(rect) {
      if (rect === null) return;
      const { left, top } = popoverPosition(rect, { width: sheet.root.offsetWidth, height: sheet.root.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }, TOP_BAR_PX);
      setVar(sheet.root, "--anchor-left", `${left}px`);
      setVar(sheet.root, "--anchor-top", `${top}px`);
    },
  };
}
