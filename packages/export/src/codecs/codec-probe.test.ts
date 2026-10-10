// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// chooseCodecs against scripted probes and a fake clock: the attempts follow codec-rule.ts,
// the waits are counted as retry time, and nothing but H.264 comes out.
import { describe, expect, it } from "vitest";
import { chooseCodecs, settleWithin, type CodecProbe, type ProbeTiming } from "./codec-probe";
import type { ProbeOutcome } from "./codec-rule";

/** Answers in order per key ("prefer-hardware", "prefer-software", "aac", "opus"), each taking `costMs` on the fake clock. */
function scripted(script: Record<string, ProbeOutcome[]>, clock: { now: number }, costMs = 100) {
  const asked: { readonly key: string; readonly deadlineMs: number }[] = [];
  const answer = (key: string, deadlineMs: number): Promise<ProbeOutcome> => {
    asked.push({ key, deadlineMs });
    clock.now += costMs;
    return Promise.resolve(script[key]?.shift() ?? "refused");
  };
  const probe: CodecProbe = {
    video: (choice, deadlineMs) => answer(choice.acceleration, deadlineMs),
    audio: (choice, deadlineMs) => answer(choice.name, deadlineMs),
  };
  return { probe, asked };
}
function fakeTiming(clock: { now: number }) {
  const waits: number[] = [];
  const timing: ProbeTiming = {
    wait: async (ms) => {
      waits.push(ms);
      clock.now += ms;
    },
    now: () => clock.now,
  };
  return { timing, waits };
}

describe("chooseCodecs", () => {
  it("takes hardware H.264 and AAC at the first attempt, with no retry time", async () => {
    const clock = { now: 0 };
    const { probe } = scripted({ "prefer-hardware": ["encoded"], aac: ["encoded"] }, clock);
    expect(await chooseCodecs({ probe, timing: fakeTiming(clock).timing })).toMatchObject({
      ok: true,
      video: { name: "avc", codec: "avc1.640028", acceleration: "prefer-hardware" },
      audio: { name: "aac", codec: "mp4a.40.2" },
      retryMs: 0,
    });
  });

  it("retries an H.264 probe that timed out twice and takes H.264 on the third attempt", async () => {
    const clock = { now: 0 };
    const { probe, asked } = scripted({ "prefer-hardware": ["timeout", "timeout"], "prefer-software": ["encoded"], aac: ["encoded"] }, clock);
    const { timing, waits } = fakeTiming(clock);
    const choice = await chooseCodecs({ probe, timing });
    expect(choice).toMatchObject({ ok: true, video: { name: "avc", acceleration: "prefer-software" } });
    expect(asked.slice(0, 3)).toEqual([
      { key: "prefer-hardware", deadlineMs: 3_000 },
      { key: "prefer-hardware", deadlineMs: 6_000 },
      { key: "prefer-software", deadlineMs: 6_000 },
    ]);
    expect(waits).toEqual([500, 1_000]);
    // Two backoffs and two attempts of 100 ms after the first one.
    expect(choice.ok && choice.retryMs).toBe(1_700);
  });

  it("takes software H.264 at once where isConfigSupported refuses the hardware", async () => {
    const clock = { now: 0 };
    const { probe } = scripted({ "prefer-hardware": ["refused"], "prefer-software": ["encoded"], aac: ["encoded"] }, clock);
    const { timing, waits } = fakeTiming(clock);
    expect(await chooseCodecs({ probe, timing })).toMatchObject({ ok: true, video: { acceleration: "prefer-software" } });
    expect(waits).toEqual([]);
  });

  it("reports NO_VIDEO_CODEC, and asks for no audio, where no H.264 encoder exists", async () => {
    const clock = { now: 0 };
    const { probe, asked } = scripted({ "prefer-hardware": ["refused"], "prefer-software": ["failed"] }, clock);
    const choice = await chooseCodecs({ probe, timing: fakeTiming(clock).timing });
    expect(choice).toMatchObject({ ok: false, reason: "NO_VIDEO_CODEC" });
    expect(asked.map((entry) => entry.key)).toEqual(["prefer-hardware", "prefer-software"]);
  });

  it("reports ENCODER_BUSY, never NO_VIDEO_CODEC, when H.264 only missed its deadlines", async () => {
    const clock = { now: 0 };
    const { probe } = scripted({ "prefer-hardware": ["timeout", "timeout"], "prefer-software": ["timeout", "timeout"] }, clock);
    expect(await chooseCodecs({ probe, timing: fakeTiming(clock).timing })).toMatchObject({ ok: false, reason: "ENCODER_BUSY" });
  });

  it("counts the warm-up's hardware frame as H.264 working when the probe's deadline passed", async () => {
    const clock = { now: 0 };
    const { probe, asked } = scripted({ "prefer-hardware": ["timeout"], aac: ["encoded"] }, clock);
    const choice = await chooseCodecs({ probe, timing: fakeTiming(clock).timing, warmUp: Promise.resolve(true) });
    expect(choice).toMatchObject({ ok: true, video: { acceleration: "prefer-hardware" }, retryMs: 0 });
    expect(asked.map((entry) => entry.key)).toEqual(["prefer-hardware", "aac"]);
  });

  it("retries an AAC deadline and never falls to Opus for it", async () => {
    const clock = { now: 0 };
    const { probe } = scripted({ "prefer-hardware": ["encoded"], aac: ["timeout", "encoded"], opus: ["encoded"] }, clock);
    expect(await chooseCodecs({ probe, timing: fakeTiming(clock).timing })).toMatchObject({ ok: true, audio: { name: "aac" } });
  });

  it("takes Opus where AAC is refused (Firefox), and NO_AUDIO_CODEC where both are", async () => {
    const clock = { now: 0 };
    const opus = scripted({ "prefer-hardware": ["encoded"], aac: ["refused"], opus: ["encoded"] }, clock);
    expect(await chooseCodecs({ probe: opus.probe, timing: fakeTiming(clock).timing })).toMatchObject({ ok: true, audio: { name: "opus" } });
    const none = scripted({ "prefer-hardware": ["encoded"] }, clock);
    expect(await chooseCodecs({ probe: none.probe, timing: fakeTiming(clock).timing })).toMatchObject({ ok: false, reason: "NO_AUDIO_CODEC" });
  });

  it("treats a probe that throws as a failure, not as a crash", async () => {
    const clock = { now: 0 };
    const probe: CodecProbe = { video: () => Promise.reject(new Error("boom")), audio: async () => "encoded" };
    expect(await chooseCodecs({ probe, timing: fakeTiming(clock).timing })).toMatchObject({ ok: false, reason: "NO_VIDEO_CODEC" });
  });
});

describe("settleWithin", () => {
  it("is a timeout when the work never settles, and a failure when it rejects", async () => {
    expect(await settleWithin(new Promise(() => undefined), 5)).toBe("timeout");
    expect(await settleWithin(Promise.reject(new Error("closed")), 1_000)).toBe("failed");
    expect(await settleWithin(Promise.resolve("encoded"), 1_000)).toBe("encoded");
  });
});
