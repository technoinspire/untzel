// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { mulberry32, type Program } from "@untzel/core";
import { analyze } from "@untzel/language";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { FakeClock, FakeEventSink, driveClock } from "./testing";
import { Transport } from "./scheduling/transport";

// End-to-end through the real language and core: the onboard template with the
// real registry.

const ONBOARD = `// onboard (phase 1: kick, hat and bass only)
tempo 132
key c minor

kick:  kick  x... x... x... x...          | drive 0.3
hat:   hat   ..x. ..x. ..x. ..xx          | swing 0.12
ride:  hat   x.x. x.x. x.x. x.x.          | open 0.7 | gain 0.4 | pan -0.3
sub:   bass  c1 . . c1 . . c1 .           | cutoff 180
bass:  bass  . c2 . c2 . c2 . eb2         | cutoff sine(8) 300..1400 | pan 0.2

section intro  kick hat sub
section build  kick hat ride sub
section drop   kick hat ride sub bass
section break  hat bass

song intro 8, build 4, drop 16, break 8, build 4, drop 16
`;

const SR = 48_000;


const registry = registryWith(["kick", "hat", "bass"]);

function programOf(text: string): Program {
  const result = analyze(text, registry);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.program;
}

function barFrame(startFrame: number, bar: number): number {
  return startFrame + Number((BigInt(bar) * 240n * BigInt(SR)) / 132n);
}

function playing(text: string, mode: "loop" | "song") {
  const clock = new FakeClock(SR);
  const sink = new FakeEventSink();
  const transport = new Transport({ clock, sink });
  transport.setProgram(programOf(text));
  clock.set(0);
  transport.play(mode);
  const startFrame = sink.activations[0]?.atFrame ?? Number.NaN;
  return { clock, sink, transport, startFrame };
}

describe("the onboard template", () => {
  it("has two independent bass tracks: sub and bass", () => {
    const { clock, sink, transport, startFrame } = playing(ONBOARD, "song");
    const tracks = sink.activations[0]?.tracks ?? [];
    const sub = tracks.findIndex((track) => track.name === "sub");
    const bassIndex = tracks.findIndex((track) => track.name === "bass");
    expect(tracks[sub]?.instrument).toBe("bass");
    expect(tracks[bassIndex]?.instrument).toBe("bass");
    expect(sub).not.toBe(bassIndex);

    const dropBar = 12; // intro 8 + build 4
    driveClock(transport, clock, barFrame(startFrame, dropBar + 1) + 10_000);
    const stepFrame = (step: number) =>
      startFrame + Number(((BigInt(dropBar) * 8n + BigInt(step)) * 240n * BigInt(SR)) / (132n * 8n));
    const inDrop = (trackIndex: number) =>
      sink
        .events()
        .filter(
          (event) =>
            event.trackIndex === trackIndex &&
            event.frame >= barFrame(startFrame, dropBar) &&
            event.frame < barFrame(startFrame, dropBar + 1),
        )
        .map((event) => [event.frame, event.value.kind === "note" ? event.value.midi : null]);
    expect(inDrop(sub)).toEqual([
      [stepFrame(0), 24],
      [stepFrame(3), 24],
      [stepFrame(6), 24],
    ]);
    expect(inDrop(bassIndex)).toEqual([
      [stepFrame(1), 36],
      [stepFrame(3), 36],
      [stepFrame(5), 36],
      [stepFrame(7), 39],
    ]);

    // A signal replaced by a constant is structural; then constant to constant is not.
    transport.setProgram(programOf(ONBOARD.replace("cutoff sine(8) 300..1400", "cutoff 900")));
    driveClock(transport, clock, (clock.nowFrame() ?? 0) + 2 * barFrame(0, 1));
    const batches = sink.batches.length;
    transport.setProgram(programOf(ONBOARD.replace("cutoff sine(8) 300..1400", "cutoff 1200")));
    const points = sink.batches.slice(batches).flatMap((batch) => batch.parameters);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({ trackIndex: bassIndex, parameter: 32, value: 1200 });
  });

  it("loops 10 minutes with exactly 1 320 kicks on their frames", () => {
    const { clock, sink, transport, startFrame } = playing(ONBOARD, "loop");
    const end = startFrame + 600 * SR;
    driveClock(transport, clock, end);
    const kicks = sink
      .events()
      .filter((event) => event.trackIndex === 0 && event.frame < end)
      .map((event) => event.frame);
    expect(kicks).toEqual(
      Array.from({ length: 1_320 }, (_, n) => startFrame + Number((BigInt(n) * 60n * BigInt(SR)) / 132n)),
    );
    expect(transport.stats()).toEqual({ skippedBars: 0, resyncs: 0 });
  }, 60_000);

  it("plays the song: each part on its frame, kick only where listed, then ends", () => {
    const { clock, sink, transport, startFrame } = playing(ONBOARD, "song");
    driveClock(transport, clock, barFrame(startFrame, 60));
    const starts = [
      [0, "intro"],
      [8, "build"],
      [12, "drop"],
      [28, "break"],
      [36, "build"],
      [40, "drop"],
    ] as const;
    for (const [bar, section] of starts) {
      const batch = sink.batches.find((candidate) => candidate.position.bar === bar && candidate.position.barInPart === 0);
      expect(batch?.position).toMatchObject({ frame: barFrame(startFrame, bar), section, totalBars: 56 });
    }
    const end = barFrame(startFrame, 56);
    expect(sink.ends).toEqual([end]);
    expect(sink.events().every((event) => event.frame < end)).toBe(true);
    const kickInBreak = sink
      .events()
      .filter(
        (event) =>
          event.trackIndex === 0 &&
          event.frame >= barFrame(startFrame, 28) &&
          event.frame < barFrame(startFrame, 36),
      );
    expect(kickInBreak).toHaveLength(0);
  });

  it("a gain edit on a text with ? keeps this bar's draws and plays the new ones from the boundary", () => {
    const before = "tempo 132\nh: hat x? x? x? x? x? x? x? x? x? x? x? x? x? x? x? x?";
    const after = `${before} | gain 0.5`;
    const frames = (text: string, edit: string | null) => {
      const { clock, sink, transport, startFrame } = playing(text, "loop");
      driveClock(transport, clock, startFrame + 20_000);
      if (edit !== null) transport.setProgram(programOf(edit));
      driveClock(transport, clock, barFrame(startFrame, 4));
      return sink.events().map((event) => event.frame - startFrame);
    };
    const edited = frames(before, after);
    const bar1 = barFrame(0, 1);
    expect(edited.filter((frame) => frame < bar1)).toEqual(
      frames(before, null).filter((frame) => frame < bar1),
    );
    const fresh = frames(after, null).filter((frame) => frame >= bar1);
    expect(edited.filter((frame) => frame >= bar1)).toEqual(fresh);
    // The two texts draw differently, so the test would catch a swap at the wrong time.
    expect(fresh).not.toEqual(frames(before, null).filter((frame) => frame >= bar1));
  });

  it("loops the song with | loop for 10 minutes: every part of every pass on its frame", () => {
    const looped = ONBOARD.replace("drop 16\n", "drop 16 | loop\n");
    const { clock, sink, transport, startFrame } = playing(looped, "song");
    const end = startFrame + 600 * SR;
    // As in drift.test.ts: ticks 25 ms apart plus 0..95 ms drawn by mulberry32(1); at
    // minute 5 the gain edit of drift.browser.ts, a parameter change that activates at once.
    const next = mulberry32(1);
    const jitter = () => 25 + next() * 95;
    driveClock(transport, clock, startFrame + 300 * SR, jitter);
    transport.setProgram(programOf(looped.replace("| drive 0.3", "| drive 0.3 | gain 0.9")));
    driveClock(transport, clock, end, jitter);
    expect(sink.ends).toEqual([]);

    // 600 s at 132 BPM is 330 bars: 5 whole passes of 56 bars and part of a sixth.
    const parts = [
      [0, "intro"],
      [8, "build"],
      [12, "drop"],
      [28, "break"],
      [36, "build"],
      [40, "drop"],
    ] as const;
    const lastBar = (600 * 132) / 240 - 1;
    let checked = 0;
    for (let pass = 0; pass * 56 <= lastBar; pass += 1) {
      for (const [offset, section] of parts) {
        const bar = pass * 56 + offset;
        if (bar > lastBar) continue;
        const batch = sink.batches.find((candidate) => candidate.position.bar === bar && candidate.position.barInPart === 0);
        expect(batch?.position, `pass ${pass}, ${section} at bar ${bar}`).toMatchObject({
          frame: barFrame(startFrame, bar),
          section,
        });
        checked += 1;
      }
    }
    expect(checked).toBe(6 * parts.length); // the sixth pass (bar 280) reaches its last drop at bar 320

    // Kick only in intro, build and drop, always on the beat grid; never in break.
    const kicks = sink.events().filter((event) => event.trackIndex === 0 && event.frame < end);
    // 48 kick bars per pass × 5 passes, plus 42 in the sixth (bars 280–329 less break 308–315); 4 kicks a bar.
    expect(kicks).toHaveLength((5 * 48 + 42) * 4);
    for (const event of kicks) {
      // Nearest beat; the exact frame of that beat is then checked in integers.
      const beat = Math.round(((event.frame - startFrame) * 132) / (60 * SR));
      expect(event.frame).toBe(startFrame + Number((BigInt(beat) * 60n * BigInt(SR)) / 132n));
      const barInPass = Math.floor(beat / 4) % 56;
      expect(barInPass >= 28 && barInPass < 36, `kick at beat ${beat} falls in break`).toBe(false);
    }
    const pairs = new Set(sink.events().map((event) => `${event.trackIndex}:${event.frame}`));
    expect(pairs.size, "no (track, frame) pair twice").toBe(sink.events().length);
    expect(transport.stats()).toEqual({ skippedBars: 0, resyncs: 0 });
  }, 60_000);
});
