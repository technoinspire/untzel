// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setText } from "../dom";
import type { TrackView } from "@untzel/presentation/view-model";
import type { PreviewSoundsSetting } from "../../behavior/preferences/preview-sounds-setting";
import { groupLabels, strings, text } from "../../copy/copy";
import { createInlineName } from "../primitives/inline-name";
import type { Sheet } from "../sheets/sheet";

// The header of the track detail: the name (an InlineName inside the h2, so the heading
// stays the name), the meta line, the "Preview sounds" switch and the sheet's ×.
// While the name is edited the meta and the switch move to the line below.

export interface TrackDetailHeaderOptions {
  /** "Preview sounds", the same setting the menu turns. */
  readonly previewSounds: PreviewSoundsSetting;
  readonly onRename: (track: string, name: string) => void;
  readonly announce: (message: string) => void;
}

export interface TrackDetailHeader {
  /** "Preview sounds" is on: a touched step or note sounds. */
  isPreviewOn(): boolean;
  /** The table's pencil and double click: the name field opens with the focus in it. */
  editName(): void;
  update(track: TrackView, others: ReadonlySet<string>): void;
}

export function createTrackDetailHeader(sheet: Sheet, options: TrackDetailHeaderOptions): TrackDetailHeader {
  let current = "";
  const name = createInlineName({
    kind: "track",
    id: "ui-detail-name",
    onRename: (next) => options.onRename(current, next),
    announce: options.announce,
  });
  sheet.heading.replaceChildren(name.root);
  sheet.heading.after(name.description);
  const meta = element("p", { className: "ui-detail__meta" });
  // Read at each touch and drawn at each update, so the menu's switch counts at once.
  const { previewSounds } = options;
  const preview = button("ui-switch ui-detail__preview", text.previewSounds, () => previewSounds.set(!previewSounds.isOn()), [
    element("span", { className: "ui-switch__track", attributes: { "aria-hidden": "true" } }),
    element("span", { text: text.previewSounds }),
  ]);
  preview.setAttribute("role", "switch");
  preview.removeAttribute("aria-label");
  preview.setAttribute("aria-checked", String(previewSounds.isOn()));
  sheet.header.insertBefore(meta, sheet.heading.nextSibling);
  sheet.header.insertBefore(preview, meta.nextSibling);

  return {
    isPreviewOn: () => previewSounds.isOn(),
    editName: () => name.edit(),
    update(track, others) {
      current = track.name;
      preview.setAttribute("aria-checked", String(previewSounds.isOn()));
      name.update(track.name, others);
      setText(meta, strings.trackMeta(track.instrument, groupLabels[track.group], track.line));
    },
  };
}
