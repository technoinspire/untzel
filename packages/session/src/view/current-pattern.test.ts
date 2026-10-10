// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import * as language from "@untzel/language";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { currentPatternOf } from "./current-pattern";
import { Session } from "../use-cases/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort } from "../testing";
const registry = registryWith(["acid", "bass", "hat", "kick", "pad", "ride"]);
function patternOf(source: string, name: string, written: "as written" | "no pattern" = "as written"): string | null {
  const session = new Session({ sound: new FakeSoundPort(), load: new FakeLoadPort(), log: new FakeDiagnosticsLog(), analyze: (text) => language.analyze(text, registry) });
  session.applyText(source);
  const view = session.view();
  const track = view.tracks.find((entry) => entry.name === name);
  const found = track === undefined ? undefined : registry.get(track.instrument);
  if (track === undefined || found === undefined) throw new Error(name);
  return currentPatternOf(written === "no pattern" ? { ...track, pattern: null } : track, found, view);
}
describe("currentPatternOf", () => {
  it("is null for a track that writes no pattern", () => {
    expect(patternOf("kick: kick x... x... x... x...\n", "kick", "no pattern")).toBeNull();
  });
  it("names the manifest's pattern written in the music's key", () => {
    expect(patternOf("key a minor\nbass: bass . a1 . a1 . a1 . a1\n", "bass")).toBe("Offbeat");
    expect(patternOf("kick: kick   x... x...   x... x...\n", "kick")).toBe("Four on the floor");
  });
  it("is null for a text that matches no pattern, or a pattern out of the music's key", () => {
    expect(patternOf("kick: kick x.x. ...x x... ....\n", "kick")).toBeNull();
    expect(patternOf("key c minor\nbass: bass . a1 . a1 . a1 . a1\n", "bass")).toBeNull();
  });
});
