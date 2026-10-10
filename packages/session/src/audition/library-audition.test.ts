// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { addTrack, analyze } from "@untzel/language";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { Audition, auditionText } from "./library-audition";
import { Session } from "../use-cases/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakePreviewPort, FakeSoundPort } from "../testing";

const registry = registryWith(["bass", "kick"]);
const bassManifest = registry.get("bass");

function setup(source = "tempo 118\nkey a minor\nkick: kick x...\n") {
  const log = new FakeDiagnosticsLog();
  const session = new Session({ sound: new FakeSoundPort(), load: new FakeLoadPort(), log, analyze: (text) => analyze(text, registry) });
  session.applyText(source);
  const port = new FakePreviewPort();
  const audition = new Audition({ session, port, registry, analyze: (text) => analyze(text, registry), log });
  return { session, port, audition, log };
}

describe("audition text", () => {
  it("uses the music's tempo and key, writes the sound only when it is not the default", () => {
    if (bassManifest === undefined) throw new Error("no bass");
    expect(auditionText(bassManifest, "bright", null, { tonic: 9, scale: "minor" }, 118)).toBe(`tempo 118\nkey a minor\np: bass bright ${bassManifest.preview} | transpose -3\n`);
    expect(auditionText(bassManifest, bassManifest.defaultPreset, null, { tonic: 0, scale: "chromatic" }, null)).toBe(`tempo 124\nkey c minor\np: bass ${bassManifest.preview}\n`);
  });

  it("plays a named pattern already in the key, the same pattern Add writes, without transpose", () => {
    if (bassManifest === undefined) throw new Error("no bass");
    const key = { tonic: 9, scale: "minor" } as const;
    const text = auditionText(bassManifest, null, "Offbeat", key, 118) ?? "";
    expect(text).toBe("tempo 118\nkey a minor\np: bass . a1 . a1 . a1 . a1\n");
    const offbeat = bassManifest.patterns.find((pattern) => pattern.name === "Offbeat") ?? null;
    const added = addTrack("key a minor\n", bassManifest, null, offbeat, key);
    expect(added.ok && added.source.split("\n")[1]).toBe("bass: bass . a1 . a1 . a1 . a1");
    expect(auditionText(bassManifest, null, "Nothing", key, 118)).toBeNull();
  });
});

describe("Audition", () => {
  it("plays bass in a minor from a, and never touches the text or the history", () => {
    const { session, port, audition } = setup();
    const before = session.state().source;
    expect(audition.play("bass", "bright")).toBe(true);
    const track = port.previews[0]?.tracks[0];
    expect(track?.instrument).toBe("bass");
    expect(track?.preset).toBe("bright");
    expect(track?.transpose).toBe(-3);
    expect(session.state().source).toBe(before);
    expect(session.view().canUndo).toBe(false);
    expect(audition.current()).toEqual({ instrument: "bass", preset: "bright", pattern: null });
  });

  it("forgets the audition when the worker says it ended, but not the end of the one it replaced", () => {
    const { port, audition } = setup();
    audition.play("kick", null);
    audition.play("bass", null);
    port.end();
    expect(audition.current()).toEqual({ instrument: "bass", preset: null, pattern: null });
    port.end();
    expect(audition.current()).toBeNull();
  });

  it("keeps an audition started after touched notes: the ends of the cut notes are not its end", () => {
    const { port, audition } = setup("tempo 120\nkey c minor\nkick: kick x...\n");
    expect(audition.playNote("kick", [48], 0.4)).toBe(true);
    expect(audition.playNote("kick", [50], 0.4)).toBe(true);
    // The second note cuts the first one's voice; the worker says that slot ended.
    port.end();
    audition.play("bass", null);
    port.end();
    expect(audition.current()).toEqual({ instrument: "bass", preset: null, pattern: null });
    // Its own end (16 bars, Play or Stop) forgets it; the next audition starts on a free slot.
    port.end();
    expect(audition.current()).toBeNull();
    audition.play("kick", null);
    port.end();
    expect(audition.current()).toBeNull();
  });
  it("forgets an audition a touched note cuts", () => {
    const { port, audition } = setup("tempo 120\nkey c minor\nkick: kick x...\n");
    audition.play("bass", null);
    audition.playNote("kick", [48], 0.4);
    port.end();
    expect(audition.current()).toBeNull();
  });
  it("plays a touched note on the track's own sound, for the duration it is given", () => {
    const { port, audition } = setup("tempo 120\nkey c minor\nkick: kick x... | gain 0.5\nbass: bass bright c2 | mute\n");
    expect(audition.playNote("kick", [48], 0.125)).toBe(true);
    expect(port.notes[0]?.seconds).toBeCloseTo(0.125);
    expect(port.notes[0]?.program.tracks.map((track) => track.name)).toEqual(["kick"]);
    expect(port.notes[0]?.program.tracks[0]?.parameters[0]?.value).toEqual({ kind: "constant", value: 0.5 });
    expect(audition.playNote("bass", [36, 39, 43], 0.4)).toBe(true);
    expect(port.notes[1]).toMatchObject({ midis: [36, 39, 43], seconds: 0.4 });
    expect(port.notes[1]?.program.tracks[0]).toMatchObject({ preset: "bright", muted: false });
    expect(audition.playNote("ride", [36], 0.4)).toBe(false);
    expect(audition.playNote("kick", [], 0.4)).toBe(false);
  });
  it("stop asks the worker; an unknown instrument plays nothing", () => {
    const { port, audition } = setup();
    expect(audition.play("theremin", null)).toBe(false);
    audition.stop();
    expect(port.stops).toBe(0);
    audition.play("kick", null);
    audition.stop();
    expect(port.stops).toBe(1);
  });
});
