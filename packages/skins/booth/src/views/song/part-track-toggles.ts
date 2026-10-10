// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, reconcile, setPressed, setText } from "../dom";
import type { SongIntents } from "@untzel/skin-contract";
import { phrases } from "../../copy/copy";
import type { TrackToggleState } from "./part-editor-state";

/** "Tracks in this part" as large toggles; a toggle edits the part's section line. */
export function createPartTrackToggles(intents: Pick<SongIntents, "toggleSectionMember">, section: () => string | null): {
  readonly root: HTMLElement;
  update(sectionName: string, tracks: readonly TrackToggleState[]): void;
} {
  const toggles = element("div", { className: "ui-part__tracks", attributes: { role: "group" } });
  const toggleNodes = new Map<string, HTMLButtonElement>();
  const createToggle = (toggle: TrackToggleState): HTMLButtonElement =>
    button("ui-trackpill", toggle.track, () => {
      const shown = section();
      if (shown !== null) intents.toggleSectionMember(shown, toggle.track);
    });
  const updateToggle = (node: HTMLButtonElement, toggle: TrackToggleState): void => {
    setPressed(node, toggle.isMember);
    setText(node, toggle.label);
    node.setAttribute("aria-label", toggle.name);
  };
  return {
    root: toggles,
    update(sectionName, tracks) {
      toggles.setAttribute("aria-label", phrases.tracksInSection(sectionName));
      reconcile(toggles, tracks, (toggle) => toggle.track, createToggle, updateToggle, toggleNodes);
    },
  };
}
