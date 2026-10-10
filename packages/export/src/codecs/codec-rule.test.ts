// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The codec rule on attempt lists: a timeout is retried and never ends in
// "unsupported", a refusal moves on, and H.264 is the only video there is.
import { describe, expect, it } from "vitest";
import {
  AUDIO_POLICY,
  decideCodec,
  FIRST_PROBE_DEADLINE_MS,
  H264_POLICY,
  MAX_PROBE_ATTEMPTS,
  MAX_PROBE_DEADLINE_MS,
  PROBE_BACKOFF_MS,
  type EncoderAcceleration,
  type ProbeAttempt,
  type ProbeOutcome,
} from "./codec-rule";

const hardware = (outcome: ProbeOutcome): ProbeAttempt<EncoderAcceleration> => ({ candidate: "prefer-hardware", outcome });
const software = (outcome: ProbeOutcome): ProbeAttempt<EncoderAcceleration> => ({ candidate: "prefer-software", outcome });
const h264 = (...attempts: ProbeAttempt<EncoderAcceleration>[]) => decideCodec(H264_POLICY, attempts);

describe("decideCodec for H.264", () => {
  it("starts on the hardware encoder at once, within the first deadline", () => {
    expect(h264()).toEqual({ kind: "retry", candidate: "prefer-hardware", delayMs: 0, deadlineMs: FIRST_PROBE_DEADLINE_MS });
  });

  it("takes the encoder that encoded", () => {
    expect(h264(hardware("encoded"))).toEqual({ kind: "codec", candidate: "prefer-hardware" });
    expect(h264(hardware("refused"), software("encoded"))).toEqual({ kind: "codec", candidate: "prefer-software" });
  });

  it("retries a timeout on the same encoder, with a backoff and a longer deadline", () => {
    expect(h264(hardware("timeout"))).toEqual({ kind: "retry", candidate: "prefer-hardware", delayMs: PROBE_BACKOFF_MS, deadlineMs: 2 * FIRST_PROBE_DEADLINE_MS });
  });

  it("never calls a timeout unsupported: the attempts run out as timed-out", () => {
    const timeouts = [hardware("timeout"), hardware("timeout"), software("timeout"), software("timeout")];
    expect(timeouts).toHaveLength(MAX_PROBE_ATTEMPTS);
    expect(h264(...timeouts)).toEqual({ kind: "timed-out" });
    expect(h264(hardware("refused"), software("timeout"), software("timeout"), software("timeout"))).toEqual({ kind: "timed-out" });
  });

  it("gives the software encoder its turn after two hardware deadlines, the backoff doubling", () => {
    expect(h264(hardware("timeout"), hardware("timeout"))).toEqual({ kind: "retry", candidate: "prefer-software", delayMs: 2 * PROBE_BACKOFF_MS, deadlineMs: MAX_PROBE_DEADLINE_MS });
    expect(h264(hardware("timeout"), hardware("timeout"), software("timeout"))).toMatchObject({ kind: "retry", candidate: "prefer-software", delayMs: 4 * PROBE_BACKOFF_MS });
  });

  it("moves to software H.264, without waiting, when isConfigSupported says false for the hardware", () => {
    expect(h264(hardware("refused"))).toEqual({ kind: "retry", candidate: "prefer-software", delayMs: 0, deadlineMs: FIRST_PROBE_DEADLINE_MS });
  });

  it("moves to software H.264 when the hardware encoder fails", () => {
    expect(h264(hardware("failed"))).toMatchObject({ kind: "retry", candidate: "prefer-software" });
    expect(h264(hardware("failed"), software("encoded"))).toEqual({ kind: "codec", candidate: "prefer-software" });
  });

  it("goes back to the hardware when software is refused after a hardware timeout", () => {
    expect(h264(hardware("timeout"), hardware("timeout"), software("refused"))).toMatchObject({ kind: "retry", candidate: "prefer-hardware" });
  });

  it("is unsupported only when both encoders refused or failed", () => {
    expect(h264(hardware("refused"), software("refused"))).toEqual({ kind: "unsupported" });
    expect(h264(hardware("failed"), software("refused"))).toEqual({ kind: "unsupported" });
  });

  it("has no candidate but H.264", () => {
    expect(H264_POLICY.candidates).toEqual(["prefer-hardware", "prefer-software"]);
  });
});

describe("decideCodec for audio", () => {
  const aac = (outcome: ProbeOutcome) => ({ candidate: "aac" as const, outcome });
  const opus = (outcome: ProbeOutcome) => ({ candidate: "opus" as const, outcome });

  it("never falls to Opus for an AAC deadline", () => {
    expect(decideCodec(AUDIO_POLICY, [aac("timeout"), aac("timeout"), aac("timeout")])).toMatchObject({ kind: "retry", candidate: "aac" });
    expect(decideCodec(AUDIO_POLICY, [aac("timeout"), aac("timeout"), aac("timeout"), aac("timeout")])).toEqual({ kind: "timed-out" });
  });

  it("takes Opus only where AAC is refused or fails (Firefox)", () => {
    expect(decideCodec(AUDIO_POLICY, [aac("refused")])).toMatchObject({ kind: "retry", candidate: "opus", delayMs: 0 });
    expect(decideCodec(AUDIO_POLICY, [aac("failed"), opus("encoded")])).toEqual({ kind: "codec", candidate: "opus" });
    expect(decideCodec(AUDIO_POLICY, [aac("refused"), opus("refused")])).toEqual({ kind: "unsupported" });
  });
});
