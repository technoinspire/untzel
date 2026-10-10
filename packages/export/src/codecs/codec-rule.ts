// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The codec rule. Pure: from the probe attempts made so
// far, the next step. A probe that misses its deadline is a busy machine, not a missing
// encoder: it is retried with a backoff and a longer deadline and never ends in
// "unsupported". Only a refusal or a failure moves on to the next candidate. The WebCodecs
// calls live in the adapter (codecs.ts); the waits are the caller's.

/**
 * What one probe attempt saw: `refused` is isConfigSupported saying no, `failed` an
 * encoder that threw, reported an error or flushed no chunk, `timeout` a flush past the
 * deadline.
 */
export type ProbeOutcome = "encoded" | "refused" | "failed" | "timeout";

export interface ProbeAttempt<Candidate extends string> {
  readonly candidate: Candidate;
  readonly outcome: ProbeOutcome;
}

export interface ProbePolicy<Candidate extends string> {
  /** In order of preference. */
  readonly candidates: readonly Candidate[];
  /**
   * Deadlines a candidate may miss before the next one gets a turn. Infinity where the next
   * one is a different format that a busy machine must never fall to (AAC to Opus).
   */
  readonly timeoutsBeforeNext: number;
}

export type CodecDecision<Candidate extends string> =
  | { readonly kind: "codec"; readonly candidate: Candidate }
  /** Probe `candidate` after `delayMs`, within `deadlineMs` (the first attempt too). */
  | { readonly kind: "retry"; readonly candidate: Candidate; readonly delayMs: number; readonly deadlineMs: number }
  /** Every candidate refused or failed, none of them by a deadline: this device cannot. */
  | { readonly kind: "unsupported" }
  /** The attempts ran out on a candidate that only missed deadlines: busy, try again. */
  | { readonly kind: "timed-out" };

export type EncoderAcceleration = "prefer-hardware" | "prefer-software";
export type AudioCodecName = "aac" | "opus";

/** H.264 only (never VP9): the hardware encoder, then the software one after two missed deadlines. */
export const H264_POLICY: ProbePolicy<EncoderAcceleration> = { candidates: ["prefer-hardware", "prefer-software"], timeoutsBeforeNext: 2 };
/** AAC; Opus only where AAC is refused or fails (Firefox), never for a deadline. */
export const AUDIO_POLICY: ProbePolicy<AudioCodecName> = { candidates: ["aac", "opus"], timeoutsBeforeNext: Number.POSITIVE_INFINITY };

export const MAX_PROBE_ATTEMPTS = 4;
export const FIRST_PROBE_DEADLINE_MS = 3_000;
export const MAX_PROBE_DEADLINE_MS = 6_000;
/** The wait after the first timeout; it doubles after each further one (0.5, 1, 2 s). */
export const PROBE_BACKOFF_MS = 500;

export function decideCodec<Candidate extends string>(policy: ProbePolicy<Candidate>, attempts: readonly ProbeAttempt<Candidate>[]): CodecDecision<Candidate> {
  const encoded = attempts.find((attempt) => attempt.outcome === "encoded");
  if (encoded !== undefined) return { kind: "codec", candidate: encoded.candidate };
  const open = policy.candidates.filter((candidate) => !isRuledOut(attempts, candidate));
  const [first, next] = open;
  if (first === undefined) return { kind: "unsupported" };
  if (attempts.length >= MAX_PROBE_ATTEMPTS) return { kind: "timed-out" };
  const candidate = next !== undefined && timeoutsOf(attempts, first) >= policy.timeoutsBeforeNext ? next : first;
  const timeouts = attempts.filter((attempt) => attempt.outcome === "timeout").length;
  const delayMs = attempts.at(-1)?.outcome === "timeout" ? PROBE_BACKOFF_MS * 2 ** (timeouts - 1) : 0;
  const deadlineMs = Math.min(MAX_PROBE_DEADLINE_MS, FIRST_PROBE_DEADLINE_MS * 2 ** timeouts);
  return { kind: "retry", candidate, delayMs, deadlineMs };
}

/** A candidate that said no or broke, as opposed to one that was only slow. */
function isRuledOut<Candidate extends string>(attempts: readonly ProbeAttempt<Candidate>[], candidate: Candidate): boolean {
  return attempts.some((attempt) => attempt.candidate === candidate && (attempt.outcome === "refused" || attempt.outcome === "failed"));
}

function timeoutsOf<Candidate extends string>(attempts: readonly ProbeAttempt<Candidate>[], candidate: Candidate): number {
  return attempts.filter((attempt) => attempt.candidate === candidate && attempt.outcome === "timeout").length;
}
