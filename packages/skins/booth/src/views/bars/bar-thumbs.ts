// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setAttributes, setPressed, setText } from "../dom";
import type { TrackView } from "@untzel/presentation/view-model";
import { phrases, strings } from "../../copy/copy";
import { barThumbStates } from "./bar-thumb-state";
import { bindBarThumbKeys, reveal } from "./bar-thumbs-keys";
import { createMiniSteps, updateMiniSteps } from "../pattern/mini-steps-view";

// The bars of a pattern as thumbnails: each one
// shows its own steps in the tile's miniature, so the person sees what is in every bar.
// The bar being edited has a flare ring (aria-pressed); the bar sounding now a white
// marker (aria-current), never the same signal. Arrow keys, Home and End move between
// them with one tab stop and edit the bar they reach; Enter or Space edits the focused
// bar again, which changes nothing. A bar past the end of a
// shorter written loop is dimmed (data-audible="false") and named so.

export interface BarThumbs {
  readonly root: HTMLElement;
  /** `audible`: how many bars play (bar-thumb-state.ts, audibleBars). */
  update(track: TrackView, editing: number, audible: number): void;
}

// Over 40 lines: one row of thumbnails built and drawn; its keys are bar-thumbs-keys.ts.
export function createBarThumbs(onEdit: (bar: number) => void): BarThumbs {
  const root = element("div", { className: "ui-thumbs", attributes: { role: "group", "aria-label": strings.bars } });
  const thumbs: HTMLButtonElement[] = [];
  let lastEditing = -1;

  const create = (index: number): HTMLButtonElement => {
    const node = button("ui-thumb", phrases.barName(index + 1), () => onEdit(index), [
      element("span", { className: "ui-thumb__marker", attributes: { "aria-hidden": "true" } }),
      createMiniSteps("ui-thumb__mini"),
      element("span", { className: "ui-thumb__label", attributes: { "aria-hidden": "true" } }),
    ]);
    node.dataset["index"] = String(index);
    return node;
  };

  bindBarThumbKeys(root, thumbs, onEdit);
  return {
    root,
    update(track, editing, audible) {
      while (thumbs.length < track.bars) {
        const node = create(thumbs.length);
        thumbs.push(node);
        root.append(node);
      }
      while (thumbs.length > track.bars) thumbs.pop()?.remove();
      root.setAttribute("aria-label", phrases.barsOfTrack(track.name));
      const hasFocus = root.contains(document.activeElement);
      barThumbStates(track, editing, audible).forEach((state, index) => {
        const thumb = thumbs[index];
        if (thumb === undefined) return;
        thumb.setAttribute("aria-label", state.name);
        setPressed(thumb, state.isEditing);
        thumb.dataset["audible"] = String(state.isAudible);
        setAttributes(thumb, { "aria-current": state.isPlaying ? "true" : null });
        if (!hasFocus) thumb.tabIndex = state.isEditing ? 0 : -1;
        const [, mini, label] = Array.from(thumb.children);
        if (mini instanceof HTMLElement) updateMiniSteps(mini, track.patternBars[index] ?? []);
        if (label !== undefined) setText(label, state.label);
      });
      // Keep the bar being edited in view on a narrow screen; no animation.
      const shown = thumbs[editing];
      if (editing !== lastEditing && shown !== undefined) reveal(root, shown);
      lastEditing = editing;
    },
  };
}
