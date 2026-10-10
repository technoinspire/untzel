// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, reconcile, setText } from "../dom";
import { trackCountLabel } from "../../behavior/text/format";
import { icon } from "../icons";
import type { TrackIntents } from "@untzel/skin-contract";
import type { TrackView, UntzelView } from "@untzel/presentation/view-model";
import { text, type Label } from "../../copy/copy";
import { createRow, updateRow, type TrackRowCallbacks } from "./track-table-row";

export interface TrackTableCallbacks extends TrackRowCallbacks {
  readonly onAddTrack: () => void;
}

export interface TrackTable {
  readonly root: HTMLElement;
  update(view: UntzelView, selected: string | null): void;
}

/** Desktop table: name, pattern, M, S and tone (no section columns; the Song view edits parts). */
// Over 40 lines: one table built and updated, with the hidden-row count it measures.
export function createTrackTable(
  intents: TrackIntents,
  callbacks: TrackTableCallbacks,
): TrackTable {
  const rows = new Map<string, HTMLElement>();
  const header = element("div", { className: "ui-table__head", attributes: { role: "row" } });
  const body = element("div", { className: "ui-table__body", attributes: { role: "rowgroup" } });
  const table = element("div", { className: "ui-table", attributes: { role: "table", "aria-label": text.tracks } }, [
    element("div", { attributes: { role: "rowgroup" } }, [header]),
    body,
  ]);
  const add = button("ui-pill ui-pill--outline ui-table__add", text.addTrack, callbacks.onAddTrack, [
    icon("plus"),
    element("span", { text: text.addTrack }),
  ]);
  add.removeAttribute("aria-label");
  const count = element("p", { className: "ui-table__count" });
  const scroller = element("div", { className: "ui-table__scroller" }, [table]);
  const root = element("section", { className: "ui-tracktable", attributes: { "aria-labelledby": "ui-tracks-title" } }, [
    element("h2", { className: "ui-tracktable__title", text: text.tracks, attributes: { id: "ui-tracks-title" } }),
    scroller,
    element("div", { className: "ui-tracktable__footer" }, [add, count]),
  ]);
  let tracks: readonly TrackView[] = [];

  let hidden = 0;
  const writeCount = (): void => setText(count, trackCountLabel(tracks.length, hidden, true));
  // Measured only after layout or a scroll: a read right after update()'s writes forced a
  // layout on every view. The body grows with the rows, the scroller with the screen.
  const measure = (): void => {
    // Rows not wholly inside the scroller's box; the body's bottom padding is not a row.
    const visibleBottom = scroller.getBoundingClientRect().bottom + 0.5;
    hidden = Array.from(body.children).filter((row) => row.getBoundingClientRect().bottom > visibleBottom).length;
    writeCount();
  };
  const resize = new ResizeObserver(measure);
  resize.observe(scroller);
  resize.observe(body);
  scroller.addEventListener("scroll", measure, { passive: true });

  return {
    root,
    update(view, selected) {
      tracks = view.tracks;
      if (header.childElementCount === 0) renderHeader(header);
      reconcile(
        body,
        view.tracks,
        (track) => track.name,
        (track) => createRow(track.name, intents, callbacks),
        (row, track) => updateRow(row, track, view.tracks.indexOf(track), selected),
        rows,
      );
      writeCount();
    },
  };
}

function renderHeader(header: HTMLElement): void {
  const column = (label: Label, className = ""): HTMLElement =>
    element("span", { className: `ui-table__th ${className}`.trim(), text: label, attributes: { role: "columnheader" } });
  header.replaceChildren(
    column("#", "ui-table__th--index"),
    column(text.track, "ui-table__th--name"),
    column(text.pattern),
    column("M", "ui-table__th--center"),
    column("S", "ui-table__th--center"),
    column(text.tone, "ui-table__th--center"),
  );
}
