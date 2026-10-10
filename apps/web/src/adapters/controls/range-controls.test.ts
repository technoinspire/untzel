// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { createTranslator } from "@untzel/i18n";
import type { PlayRanges, PlayRangeView, Session } from "@untzel/session";
import { afterEach, describe, expect, it } from "vitest";
import { addAnnouncementTranslation, installAnnouncements } from "../../strings/copy";
import announcementsPortuguese from "../../strings/pt-BR";
import type { ControlsFeedback } from "./feedback";
import { followed, RangeControls } from "./range-controls";

const translator = createTranslator("en");
installAnnouncements(translator);
addAnnouncementTranslation(announcementsPortuguese);
afterEach(() => translator.setLocale("en"));

const rangeView = (range: PlayRangeView["range"], mode: PlayRangeView["mode"] = "loop"): PlayRangeView =>
  ({ mode, range, loop: null, song: null, lastBar: 32, songNames: null, notice: null }) as PlayRangeView;

/** The use cases always accept; the song has a build at bar 9. */
function controls(): { readonly range: RangeControls; readonly said: string[] } {
  const said: string[] = [];
  const ok = () => ({ ok: true }) as const;
  const ranges = { subscribe: () => () => undefined, view: () => rangeView(null), playFrom: ok, playFromPart: ok } as unknown as PlayRanges;
  const session = { view: () => ({ song: { parts: [{ section: "intro", start: 0 }, { section: "build", start: 8 }] } }) } as unknown as Session;
  const feedback = { announce: (message: string) => said.push(message) } as unknown as ControlsFeedback;
  return { range: new RangeControls({ ranges, session, feedback, exporter: { followPlayRange: () => undefined } }), said };
}

describe("the play range announcements", () => {
  it("say Play from here with the catalog's words, in English and in pt-BR", () => {
    const { range, said } = controls();
    range.playFrom(3);
    range.playFromPart(1);
    translator.setLocale("pt-BR");
    range.playFrom(3);
    range.playFromPart(1);
    expect(said).toEqual([
      "Playing from bar 3, from the next bar.",
      "Playing from build, bar 9, from the next bar.",
      "Tocando a partir do compasso 3, no próximo compasso.",
      "Tocando a partir de build, compasso 9, no próximo compasso.",
    ]);
  });
});

describe("the range the export sheet follows", () => {
  it("is the range of the mode asked for, with its words; nothing without one", () => {
    expect(followed(rangeView(null))).toBeNull();
    expect(followed(rangeView({ startBar: 13, endBar: 28 } as NonNullable<PlayRangeView["range"]>))).toEqual({ mode: "loop", startBar: 13, endBar: 28, label: "Bars 13–28" });
    const song = { ...rangeView({ startBar: 9, endBar: 28 } as NonNullable<PlayRangeView["range"]>, "song"), songNames: { first: "build", last: "drop", repeated: false, single: false } };
    expect(followed(song)?.label).toBe("Bars 9–28 · build → drop");
  });
});
