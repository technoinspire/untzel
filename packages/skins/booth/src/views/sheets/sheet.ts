// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element } from "../dom";
import { icon } from "../icons";
import { text, type Label } from "../../copy/copy";
import { attachDragToClose } from "./sheet-drag-to-close";

export interface Sheet {
  readonly root: HTMLElement;
  readonly heading: HTMLHeadingElement;
  readonly header: HTMLElement;
  readonly body: HTMLElement;
}

export interface SheetOptions {
  readonly id: string;
  readonly title: Label;
  readonly className: string;
  readonly onClose: () => void;
}

/**
 * Bottom sheet on mobile, side panel content on desktop. The music and the stage stay
 * live behind it either way. Whether it is modal is not the sheet's call: the shell's
 * modal guard (layer-modality.ts) marks the top sheet under 1200 px. Title is
 * an h2 (the page has a single h1).
 */
export function createSheet(options: SheetOptions): Sheet {
  const headingId = `${options.id}-title`;
  const heading = element("h2", { className: "ui-sheet__title", text: options.title, attributes: { id: headingId, tabindex: -1 } });
  const close = button("ui-round ui-round--raised ui-sheet__close", text.close, options.onClose, [icon("close")]);
  const header = element("div", { className: "ui-sheet__header" }, [heading, close]);
  const body = element("div", { className: "ui-sheet__body" });
  const handle = element("span", { className: "ui-sheet__handle", attributes: { "aria-hidden": "true" } });
  const root = element("section", {
    className: `ui-sheet ${options.className}`,
    attributes: { id: options.id, role: "dialog", "aria-labelledby": headingId, hidden: true },
  }, [handle, header, body]);
  attachDragToClose(root, handle, header, body, options.onClose);
  return { root, heading, header, body };
}
