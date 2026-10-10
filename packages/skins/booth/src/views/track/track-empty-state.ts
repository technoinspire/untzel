// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element } from "../dom";
import { icon } from "../icons";
import type { LibraryIntents } from "@untzel/skin-contract";
import { text, translator } from "../../copy/copy";
import { trackEmptyStateModel } from "./track-empty-state-model";

// "Start with a sound": in place of the tiles and the table when the
// program has no track. The same sentence and icons on the phone and the desktop.

export interface TrackEmptyState {
  readonly root: HTMLElement;
  /** Add track, where the focus goes after Start from scratch. */
  readonly addTrack: HTMLButtonElement;
  update(starters: readonly string[], isEmpty: boolean): void;
}

export function createTrackEmptyState(intents: Pick<LibraryIntents, "startWithSound">, onAddTrack: () => void, onStarted: (track: string) => void): TrackEmptyState {
  const addTrack = button("ui-pill ui-pill--primary ui-empty__add", text.addTrack, onAddTrack, [icon("plus"), element("span", { text: text.addTrack })]);
  addTrack.removeAttribute("aria-label");
  const chips = element("div", { className: "ui-empty__starters", attributes: { role: "group", "aria-label": text.tapToHear } });
  const root = element("section", { className: "ui-empty", attributes: { "aria-labelledby": "ui-empty-title", hidden: true } }, [
    element("h2", { className: "ui-empty__title", text: text.startWithSound, attributes: { id: "ui-empty-title" } }),
    element("p", { className: "ui-empty__hint", text: text.startWithSoundHint }),
    addTrack,
    element("p", { className: "ui-empty__lead", text: text.tapToHear }),
    chips,
  ]);
  let shown = "";

  return {
    root,
    addTrack,
    update(starters, isEmpty) {
      root.hidden = !isEmpty;
      // The language is part of the key: the starters' names are drawn here, not bound.
      const key = `${translator.locale()}:${starters.join(",")}`;
      if (key === shown) return;
      shown = key;
      chips.replaceChildren(...trackEmptyStateModel(starters).starters.map((starter) => {
        const node = button("ui-pill ui-pill--raised ui-empty__starter", starter.name, () => {
          const track = intents.startWithSound(starter.instrument);
          if (track !== "") onStarted(track);
        }, [icon(starter.icon), element("span", { text: starter.label, attributes: { "aria-hidden": "true" } })]);
        return node;
      }));
    },
  };
}
