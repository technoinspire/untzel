// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element, setVar } from "../dom";
import type { TransportView } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";
import { createSheet, type Sheet } from "./sheet";

export interface CodeSheet extends Sheet {
  /** Where the composition mounts the editor (@untzel/editor). */
  readonly editorHost: HTMLElement;
  update(transport: TransportView): void;
}

/** The Code sheet's chrome: heading, Undo and Redo, next-bar progress and the editor slot. */
export function createCodeSheet(onClose: () => void, history: HTMLElement): CodeSheet {
  const sheet = createSheet({ id: "ui-code", title: text.code, className: "ui-sheet--code", onClose });
  history.classList.add("ui-code__history");
  sheet.header.insertBefore(history, sheet.heading.nextSibling);
  const progress = element("span", { className: "ui-code__progress", attributes: { "aria-hidden": "true" } }, [
    element("span", { className: "ui-code__progress-fill" }),
  ]);
  const applies = element("p", { className: "ui-code__applies" }, [
    element("span", { className: "ui-code__applies-mobile", text: text.appliesNextBar }),
    element("span", { className: "ui-code__applies-desktop", text: text.appliesNextBarDesktop }),
    progress,
  ]);
  sheet.header.insertBefore(applies, sheet.heading.nextSibling);
  const editorHost = element("div", { className: "ui-code__editor" });
  sheet.body.append(editorHost, element("p", { className: "ui-code__shortcuts", text: text.shortcutsHint }));
  return {
    ...sheet,
    editorHost,
    update(transport) {
      setVar(progress, "--fill", transport.nextBar);
    },
  };
}
