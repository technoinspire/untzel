// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { SessionSync, textDiff } from "./session-sync";

const TEXT = "tempo 132\nkick: kick x... x...\nhat: hat ..x. ..x.\n";

describe("SessionSync", () => {
  it("keeps the typing and a control edit made during the typing pause", () => {
    const sync = new SessionSync(TEXT);
    let state = EditorState.create({ doc: TEXT });
    // The person types " | gain 0.5" at the end of the hat line…
    const at = TEXT.indexOf("\n", TEXT.indexOf("hat:"));
    const typed = state.update({ changes: { from: at, insert: " | gain 0.5" } });
    sync.recordLocal(typed.changes);
    state = typed.state;
    // …and, before the 300 ms pause ends, a tile mutes the kick in the session.
    const session = TEXT.replace("kick x... x...", "kick x... x... | mute");
    const changes = sync.incoming(session);
    expect(changes).not.toBeNull();
    if (changes !== null) state = state.update({ changes }).state;
    const merged = state.doc.toString();
    expect(merged).toBe("tempo 132\nkick: kick x... x... | mute\nhat: hat ..x. ..x. | gain 0.5\n");
    // The pause ends: the merged document goes to the session and becomes the base.
    sync.sent(merged);
    expect(sync.hasLocalEdits).toBe(false);
    expect(sync.incoming(merged)).toBeNull();
  });

  it("replaces only the changed span when nothing is pending", () => {
    const sync = new SessionSync(TEXT);
    const next = TEXT.replace("..x. ..x.", "..x. ..xx");
    const replaced: string[] = [];
    sync.incoming(next)?.iterChanges((from, to, _fromB, _toB, inserted) => replaced.push(`${from}-${to}:${inserted.toString()}`));
    const at = next.length - 2;
    expect(replaced).toEqual([`${at}-${at + 1}:x`]);
    expect(sync.incoming(next)).toBeNull();
  });

  it("diffs by common prefix and suffix", () => {
    const changes = textDiff("abcdef", "abXYef");
    expect(changes.apply(EditorState.create({ doc: "abcdef" }).doc).toString()).toBe("abXYef");
    const spans: [number, number][] = [];
    changes.iterChangedRanges((from, to) => spans.push([from, to]));
    expect(spans).toEqual([[2, 4]]);
    expect(textDiff("same", "same").empty).toBe(true);
  });
});
