// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Opening a .untzel file: the hidden file input behind Open file (Share sheet,
// waiting stage) and dragging a file onto the page end in the same intent, which decides
// whether the file can be a song. While a file is over the page, app[data-dropping]
// shows the hint: a state change, no animation.
import { element } from "../dom";
import type { AppPhase } from "@untzel/presentation/view-model";
import { text } from "../../copy/copy";

const ACCEPT = ".untzel,text/x-untzel,text/plain";

export interface FileOpen {
  /** The hidden input and the drop hint, to append to the app. */
  readonly nodes: readonly HTMLElement[];
  /** Opens the system file picker; call inside the click. */
  pick(): void;
  /** Listens for files dragged onto `app`. */
  attachDrop(app: HTMLElement, phase: () => AppPhase): void;
}

/** A drag can drop only files, and only while the waiting stage or the app is up. */
export function acceptsDrop(phase: AppPhase, types: readonly string[] | undefined): boolean {
  return (phase === "idle" || phase === "running") && (types?.includes("Files") ?? false);
}

export function createFileOpen(open: (file: File) => void): FileOpen {
  const picker = element("input", {
    className: "ui-visually-hidden",
    attributes: { type: "file", accept: ACCEPT, tabindex: -1, "aria-hidden": "true" },
  });
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    picker.value = "";
    if (file !== undefined) open(file);
  });
  const hint = element("p", { className: "ui-drop", text: text.dropToOpen, attributes: { "aria-hidden": "true" } });
  return {
    nodes: [hint, picker],
    pick: () => picker.click(),
    attachDrop: (app, phase) => attachDrop(app, phase, open),
  };
}

function attachDrop(app: HTMLElement, phase: () => AppPhase, open: (file: File) => void): void {
  const accepts = (event: DragEvent): boolean => acceptsDrop(phase(), event.dataTransfer?.types);
  let depth = 0;
  const setDropping = (isDropping: boolean): void => {
    if (isDropping) app.dataset["dropping"] = "true";
    else delete app.dataset["dropping"];
  };
  app.addEventListener("dragenter", (event) => {
    if (!accepts(event)) return;
    depth += 1;
    setDropping(true);
  });
  app.addEventListener("dragover", (event) => {
    if (!accepts(event)) return;
    event.preventDefault();
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = "copy";
  });
  app.addEventListener("dragleave", () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) setDropping(false);
  });
  app.addEventListener("drop", (event) => {
    depth = 0;
    setDropping(false);
    if (!accepts(event)) return;
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file !== undefined) open(file);
  });
}
