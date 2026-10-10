// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Program } from "@untzel/core";
import type { AnalyzeResult, Diagnostic } from "@untzel/language";
import { fakeProgram, fakeTrack } from "@untzel/transport/testing";
import { describe, expect, it } from "vitest";
import { Session } from "../use-cases/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort, FakeTitleEditor } from "../testing";
import { TitleEdits } from "./title";
function titled(title: string | null): Program {
  return { ...fakeProgram([fakeTrack("kick")]), title };
}
const EMPTY: Diagnostic = { code: "EMPTY_TITLE", message: "empty", messageKey: "emptyTitle", messageArgs: [], from: 6, to: 8, severity: "warning" };
const TEXTS: Record<string, AnalyzeResult> = {
  "kick x...": { ok: true, program: titled(null), warnings: [] },
  'title "Night"\nkick x...': { ok: true, program: titled("Night"), warnings: [] },
  'title "Midnight Coast"\nkick x...': { ok: true, program: titled("Midnight Coast"), warnings: [] },
  'title ""\nkick x...': { ok: true, program: titled(null), warnings: [EMPTY] },
};
function setup(source: string) {
  const sound = new FakeSoundPort();
  const session = new Session({
    sound,
    load: new FakeLoadPort(),
    log: new FakeDiagnosticsLog(),
    analyze: (text) => TEXTS[text] ?? { ok: false, diagnostics: [] },
  });
  session.applyText(source);
  const editor = new FakeTitleEditor();
  return { session, editor, sound, titles: new TitleEdits({ session, editor }) };
}
describe("TitleEdits.setTitle", () => {
  it("writes the title through applyText: one undo step", () => {
    const { session, editor, titles } = setup("kick x...");
    expect(titles.setTitle("  Night ")).toEqual({ kind: "changed", title: "Night" });
    expect(editor.titles).toEqual(["Night"]);
    expect(session.view().title).toBe("Night");
    expect(session.view().canUndo).toBe(true);
    session.undo();
    expect(session.view().title).toBeNull();
  });
  it("the same title writes nothing", () => {
    const { session, editor, titles } = setup('title "Night"\nkick x...');
    expect(titles.setTitle("Night")).toEqual({ kind: "unchanged" });
    expect(editor.titles).toEqual([]);
    expect(session.view().canUndo).toBe(false);
  });
  it("an empty title is invalid and the old one stays", () => {
    const { session, editor, titles } = setup('title "Night"\nkick x...');
    expect(titles.setTitle(" \n\t")).toEqual({ kind: "invalid" });
    expect(editor.titles).toEqual([]);
    expect(session.view().title).toBe("Night");
  });
  it("a refused edit is invalid", () => {
    const { editor, titles } = setup("kick x...");
    editor.result = { ok: false, reason: "INVALID_VALUE" };
    expect(titles.setTitle("Night")).toEqual({ kind: "invalid" });
  });
});
describe("SessionView.title", () => {
  it("is null without a title line and follows the line", () => {
    const { session } = setup("kick x...");
    expect(session.view().title).toBeNull();
    session.applyText('title "Midnight Coast"\nkick x...');
    expect(session.view().title).toBe("Midnight Coast");
  });
  it("an empty title line keeps the title before it", () => {
    const { session } = setup('title "Night"\nkick x...');
    session.applyText('title ""\nkick x...');
    expect(session.view().title).toBe("Night");
  });
  it("an invalid text keeps the last valid title", () => {
    const { session } = setup('title "Night"\nkick x...');
    session.applyText('title "Night\nkick x...');
    expect(session.view().title).toBe("Night");
  });
});
describe("Session.openText", () => {
  it("opens another song with an empty history: undo never reaches the song before", () => {
    const { session } = setup('title "Night"\nkick x...');
    session.applyText("kick x...");
    expect(session.view().canUndo).toBe(true);
    session.openText('title "Midnight Coast"\nkick x...');
    expect(session.view()).toMatchObject({ title: "Midnight Coast", canUndo: false, canRedo: false });
  });
});
