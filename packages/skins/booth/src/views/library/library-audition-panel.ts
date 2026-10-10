// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setPressed } from "../dom";
import { icon } from "../icons";
import { cellAttributes } from "../../behavior/library/library-grid";
import { addLabel, namedPattern, playingLabel, trackPlaysLabel, useLabel } from "../../behavior/library/library-labels";
import type { LibraryMode } from "../../behavior/library/library-mode";
import type { AuditionView, LibraryEntryView } from "@untzel/presentation/view-model";
import { soundChangeSummary } from "../../behavior/feedback/sound-change-summary";
import { strings } from "../../copy/copy";
import type { LibraryRowActions } from "./library-row-actions";

// The open row of the library while it plays (and for Change sound): what
// plays, the sounds as chips, in add mode the patterns as chips under them,
// and the button that adds or uses what is heard. Chips are siblings of the
// row's buttons, never inside another control.

function chip(label: string, isChosen: boolean, onClick: () => void, extra: readonly Node[] = []): HTMLButtonElement {
  const node = button("ui-pill ui-pill--chip ui-library__chip", label, onClick, [icon("check"), element("span", { text: label }), ...extra]);
  node.removeAttribute("aria-label");
  setPressed(node, isChosen);
  return node;
}

function group(label: string, ariaLabel: string, chips: readonly HTMLElement[]): HTMLElement[] {
  return [
    element("p", { className: "ui-library__label", text: label }),
    element("div", { className: "ui-library__sounds", attributes: { role: "group", "aria-label": ariaLabel } }, chips),
  ];
}

export function createLibraryAuditionPanel(entry: LibraryEntryView, playing: AuditionView, mode: LibraryMode, actions: LibraryRowActions): HTMLElement {
  const sounds = entry.sounds.map((sound) => {
    const node = chip(sound.name, sound.name === playing.sound, () => actions.preview(entry.instrument, sound.name, playing.pattern));
    node.title = sound.description;
    return node;
  });
  if (mode.kind === "replace") {
    return element("div", { className: "ui-library__audition", attributes: cellAttributes() }, [
      element("p", { className: "ui-library__playing" }, [icon("level"), element("span", { text: trackPlaysLabel(mode.track.name, entry.instrument, playing.sound) })]),
      element("p", { className: "ui-library__note", text: strings.trackPreviewNote }),
      ...group(strings.soundsLabel, strings.instrumentSounds(entry.instrument), sounds),
      element("p", { className: "ui-library__summary", text: soundChangeSummary(mode.track, entry) }),
      button("ui-pill ui-pill--primary ui-library__add-sound", useLabel(entry, playing.sound), () => actions.choose(entry.instrument, playing.sound, null)),
    ]);
  }
  const patterns = entry.patterns.map((pattern, index) =>
    chip(pattern, pattern === playing.pattern, () => actions.preview(entry.instrument, playing.sound, pattern), index === 0 ? [element("span", { className: "ui-library__default", text: strings.defaultPattern })] : []),
  );
  return element("div", { className: "ui-library__audition", attributes: cellAttributes() }, [
    element("p", { className: "ui-library__playing" }, [icon("level"), element("span", { text: playingLabel(playing.sound, playing.key, namedPattern(entry, playing.pattern)) })]),
    ...group(strings.soundsLabel, strings.instrumentSounds(entry.instrument), sounds),
    ...(patterns.length === 0 ? [] : group(strings.patternsLabel, strings.patternsFor(entry.instrument), patterns)),
    button("ui-pill ui-pill--primary ui-library__add-sound", addLabel(entry, playing.sound, playing.pattern), () => actions.choose(entry.instrument, playing.sound, playing.pattern)),
  ]);
}
