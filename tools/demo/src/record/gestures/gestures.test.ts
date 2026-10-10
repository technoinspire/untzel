// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Each gesture against a FakePage: the controls it reaches, by role and English name, and
// the order of the presses.
import { simRegistry } from "@untzel/sim/registry";
import { describe, expect, it } from "vitest";
import type { DemoAction } from "../../actions";
import { FakePage, type FoundBy } from "../fake-page";
import { perform } from ".";

const { registry } = simRegistry();
const SOURCE = "kick: kick x... x... x... x...\nbass: bass c2 . . . c2 . . .\n";

async function linesOf(action: DemoAction, options: { readonly source?: string; readonly isPhone?: boolean; readonly page?: FakePage } = {}): Promise<string[]> {
  const page = options.page ?? new FakePage();
  await perform(page, action, { source: options.source ?? SOURCE, registry, isPhone: options.isPhone ?? false });
  return page.lines();
}

/** Every control shows except the ones whose last step is named one of `hidden`. */
function hiding(...hidden: string[]): (path: readonly FoundBy[]) => boolean {
  return (path) => !hidden.includes(path.at(-1)?.name ?? "");
}

describe("the gestures", () => {
  it("addTrack: opens Add track, types the search, previews, picks the sound, adds", async () => {
    const lines = await linesOf({ kind: "addTrack", instrument: "bass", track: "bass", preset: "rolling" });
    expect(lines).toEqual([
      "click button:Add track",
      "click dialog:Add track › combobox:Search instruments and sounds",
      "press dialog:Add track › combobox:Search instruments and sounds (ControlOrMeta+a)",
      "pressSequentially dialog:Add track › combobox:Search instruments and sounds (bass)",
      "click dialog:Add track › button:Preview bass",
      "click dialog:Add track › group:bass sounds › button:rolling",
      "click dialog:Add track › button:Add bass · rolling",
    ]);
  });
  it("addTrack with the instrument's own sound adds it from its row", async () => {
    const lines = await linesOf({ kind: "addTrack", instrument: "kick", track: "kick", preset: null });
    expect(lines.at(-1)).toBe("click dialog:Add track › button:Add kick");
  });
  it("renameTrack: the name in the detail, typed over, Enter", async () => {
    expect(await linesOf({ kind: "renameTrack", track: "bass", newName: "sub" })).toEqual([
      "click dialog:bass › button:bass",
      "press textbox:Track name (ControlOrMeta+a)",
      "pressSequentially textbox:Track name (sub)",
      "press textbox:Track name (Enter)",
    ]);
  });
  it("opens the track's detail from its row on a desktop, and from Adjust on a phone", async () => {
    const page = new FakePage({ isVisible: hiding("bass", "Code") });
    expect((await linesOf({ kind: "setStepCount", track: "bass", count: 16, hold: false }, { page }))[0]).toBe("click button:^bass, ");
    const phone = new FakePage({ isVisible: hiding("bass", "Code") });
    expect((await linesOf({ kind: "setStepCount", track: "bass", count: 16, hold: false }, { page: phone, isPhone: true }))[0]).toBe("click button:Adjust bass");
  });
  it("setStepCount and setTrackBars: the detail's buttons and the length picker", async () => {
    expect(await linesOf({ kind: "setStepCount", track: "kick", count: 16, hold: false })).toEqual(["click dialog:kick › group:Steps per bar › button:16 steps per bar"]);
    expect(await linesOf({ kind: "setTrackBars", track: "kick", bars: 4 })).toEqual([
      "click dialog:kick › button:^Pattern length ",
      "click dialog:Pattern length · kick › button:4 bars",
    ]);
  });
  it("toggleStep: a drum step is one tap; a pitched step becomes a rest in the picker", async () => {
    expect(await linesOf({ kind: "toggleStep", track: "kick", bar: 0, step: 2 })).toEqual([
      "click dialog:kick › group:Bars of kick › button:Bar 1",
      "click dialog:kick › table:Steps, bar 1 › button:^Step 3,",
    ]);
    const shown = new FakePage({ attribute: (path, name) => (name === "aria-pressed" && path.at(-1)?.name === "Bar 1" ? "true" : null) });
    expect(await linesOf({ kind: "toggleStep", track: "bass", bar: 0, step: 4 }, { page: shown })).toEqual([
      "click dialog:bass › table:Steps, bar 1 › button:^Step 5,",
      "click dialog:bass › group:The step is › button:Rest",
    ]);
  });
  it("setStepNote: the step, the key, then Choose", async () => {
    expect(await linesOf({ kind: "setStepNote", track: "bass", bar: 1, step: 2, note: "eb2" })).toEqual([
      "click dialog:bass › group:Bars of bass › button:Bar 2",
      "click dialog:bass › table:Steps, bar 2 › button:^Step 3,",
      "click dialog:bass › button:E flat 2",
      "click dialog:bass › button:Choose eb2",
    ]);
  });
  it("setParameter: a slider, the gain fader's arrows, or the Code panel", async () => {
    expect(await linesOf({ kind: "setParameter", track: "kick", parameter: "pan", value: 0.5 })).toEqual(["fill dialog:kick › slider:pan (750)"]);
    expect(await linesOf({ kind: "setParameter", track: "kick", parameter: "gain", value: 1 })).toEqual(["dblclick dialog:kick › slider:gain"]);
    const typed = await linesOf({ kind: "setParameter", track: "kick", parameter: "pan", value: 0.12345 });
    expect(typed.slice(0, 1)).toEqual(["click textbox:Untzel source"]);
    expect(typed.slice(-2)).toEqual(["keyboard.press (ControlOrMeta+Enter)", "keyboard.press (Home)"]);
  });
  it("setMute: the M of the track, only when it is not as asked", async () => {
    expect(await linesOf({ kind: "setMute", track: "kick", muted: true })).toEqual(["click button:Mute kick"]);
    const pressed = new FakePage({ attribute: (_, name) => (name === "aria-pressed" ? "true" : null) });
    expect(await linesOf({ kind: "setMute", track: "kick", muted: true }, { page: pressed })).toEqual([]);
  });
  it("setLoopBars: the transport's Length chip and the picker", async () => {
    expect(await linesOf({ kind: "setLoopBars", bars: 8 })).toEqual(["click button:^Loop length ", "click dialog:Loop length › button:8 bars"]);
  });
  it("addSectionMember: the part's toggle, after opening the part when it is not shown", async () => {
    expect(await linesOf({ kind: "addSectionMember", section: "intro", track: "bass" })).toEqual(["click button:bass in intro"]);
    const closed = new FakePage({ isVisible: hiding("bass in intro", "Code") });
    expect(await linesOf({ kind: "addSectionMember", section: "intro", track: "bass" }, { page: closed })).toEqual([
      "click list:Parts of the song › button:^intro, ",
      "click button:bass in intro",
    ]);
  });
  it("typeCode: the editor, the caret by keys, the text key by key or in bursts, then Mod+Enter and Home", async () => {
    const keys = await linesOf({ kind: "typeCode", placement: { kind: "appendLine" }, text: "tempo 124", reason: "global", pace: "keys" });
    expect(keys).toEqual([
      "click textbox:Untzel source",
      "keyboard.press (ControlOrMeta+End)",
      "pressSequentially textbox:Untzel source (tempo 124)",
      "keyboard.press (ControlOrMeta+Enter)",
      "keyboard.press (Home)",
    ]);
    const bursts = await linesOf({ kind: "typeCode", placement: { kind: "appendLine" }, text: "hat: hat ..x. ..x. | gain 0.5", reason: "band", pace: "bursts" });
    expect(bursts).toEqual([
      "click textbox:Untzel source",
      "keyboard.press (ControlOrMeta+End)",
      "keyboard.insertText (hat: hat )",
      "keyboard.insertText (..x. ..x. )",
      "keyboard.insertText (| gain 0.5)",
      "keyboard.press (ControlOrMeta+Enter)",
      "keyboard.press (Home)",
    ]);
  });
  it("typeCode opens the Code panel from the transport when it is closed", async () => {
    const page = new FakePage({ isVisible: hiding("Untzel source") });
    const lines = await linesOf({ kind: "typeCode", placement: { kind: "appendLine" }, text: "tempo 124", reason: "global", pace: "keys" }, { page });
    expect(lines[0]).toBe("click button:Code");
  });
  it("togglePlay, setMode and drop: the transport's buttons; on a phone, Song first", async () => {
    expect(await linesOf({ kind: "togglePlay" })).toEqual(["click region:Transport › button:Play"]);
    expect(await linesOf({ kind: "drop" })).toEqual(["click button:Drop"]);
    expect(await linesOf({ kind: "setMode", mode: "song" })).toEqual(["click group:Mode › button:Song"]);
    expect(await linesOf({ kind: "setMode", mode: "song" }, { isPhone: true })).toEqual([
      "click complementary:Side panel › button:Close",
      "click navigation:Views › button:Song",
      "click group:Mode › button:Song",
    ]);
  });
  it("on a phone, closes the panel beside the stage before a control of the views, and mutes by the tile", async () => {
    const closed = new FakePage({ isVisible: hiding("Side panel", "Untzel source") });
    expect(await linesOf({ kind: "setMute", track: "kick", muted: true }, { page: closed, isPhone: true })).toEqual([]);
    const playing = new FakePage({ isVisible: hiding("Side panel"), attribute: (_, name) => (name === "aria-pressed" ? "true" : null) });
    expect(await linesOf({ kind: "setMute", track: "kick", muted: true }, { page: playing, isPhone: true })).toEqual(["click region:Tracks › button:^kick, "]);
    const open = new FakePage({ isVisible: hiding("Untzel source") });
    const typed = await linesOf({ kind: "typeCode", placement: { kind: "appendLine" }, text: "tempo 124", reason: "global", pace: "keys" }, { page: open, isPhone: true });
    expect(typed.slice(0, 2)).toEqual(["click complementary:Side panel › button:Close", "click button:Code"]);
    const desktop = await linesOf({ kind: "typeCode", placement: { kind: "appendLine" }, text: "tempo 124", reason: "global", pace: "keys" }, { page: new FakePage({ isVisible: hiding("Untzel source") }) });
    expect(desktop[0]).toBe("click button:Code");
  });
});
