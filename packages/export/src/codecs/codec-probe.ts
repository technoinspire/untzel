// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Which codecs this browser really encodes, by a real probe and not by isConfigSupported
// alone: Playwright's WebKit says yes to H.264 and never delivers a chunk (measured). Each
// attempt encodes two frames (or 0.1 s of silence) with the final configuration and must
// settle before its deadline. What to try next, and when to stop, is codec-rule.ts's; this
// file only runs the attempts and waits.
import {
  AUDIO_POLICY,
  decideCodec,
  H264_POLICY,
  type CodecDecision,
  type ProbeAttempt,
  type ProbeOutcome,
  type ProbePolicy,
} from "./codec-rule";
import {
  audioChoice,
  audioEncoderConfig,
  h264Choice,
  PROBE_FRAME,
  videoEncoderConfig,
  type AudioCodecChoice,
  type VideoCodecChoice,
} from "./codecs";
import { SAMPLE_RATE } from "../plan";

const PROBE_FRAMES = 2;
const PROBE_AUDIO_FRAMES = SAMPLE_RATE / 10;

export interface CodecProbe {
  video(choice: VideoCodecChoice, deadlineMs: number): Promise<ProbeOutcome>;
  audio(choice: AudioCodecChoice, deadlineMs: number): Promise<ProbeOutcome>;
}

/** The clock of the retries; the worker passes setTimeout and performance.now. */
export interface ProbeTiming {
  wait(ms: number): Promise<void>;
  now(): number;
}

export type CodecFailure = "NO_VIDEO_CODEC" | "NO_AUDIO_CODEC" | "ENCODER_BUSY";

export type CodecChoice =
  | {
      readonly ok: true;
      readonly video: VideoCodecChoice;
      readonly audio: AudioCodecChoice;
      /**
       * Milliseconds spent after each format's first attempt (backoffs and retries): what a
       * busy machine added. Zero when both first attempts encoded. The render budget is
       * measured without it.
       */
      readonly retryMs: number;
      readonly tried: readonly string[];
    }
  | { readonly ok: false; readonly reason: CodecFailure; readonly tried: readonly string[] };

export interface ChooseCodecsInput {
  readonly probe: CodecProbe;
  readonly timing: ProbeTiming;
  /**
   * The hardware H.264 warm-up running beside the first probe (encoder-warm-up.ts): when it
   * encoded at the job's own size, H.264 on the hardware works, whatever the probe's deadline said.
   */
  readonly warmUp?: Promise<boolean>;
}

/** H.264 and AAC (Opus where AAC is refused), for story and video; the WAV needs none. */
export async function chooseCodecs(input: ChooseCodecsInput): Promise<CodecChoice> {
  const { probe, timing, warmUp } = input;
  const tried: string[] = [];
  const warmed = warmUp?.then((isWarm): ProbeAttempt<VideoCodecChoice["acceleration"]> | null => (isWarm ? { candidate: "prefer-hardware", outcome: "encoded" } : null));
  const video = await probeUntilDecided(H264_POLICY, (acceleration, deadlineMs) => probe.video(h264Choice(acceleration), deadlineMs), { timing, tried, label: "avc1", alongsideFirst: warmed });
  if (video.decision.kind !== "codec") return { ok: false, reason: failureOf(video.decision, "NO_VIDEO_CODEC"), tried };
  const audio = await probeUntilDecided(AUDIO_POLICY, (name, deadlineMs) => probe.audio(audioChoice(name), deadlineMs), { timing, tried, label: "audio" });
  if (audio.decision.kind !== "codec") return { ok: false, reason: failureOf(audio.decision, "NO_AUDIO_CODEC"), tried };
  return {
    ok: true,
    video: h264Choice(video.decision.candidate),
    audio: audioChoice(audio.decision.candidate),
    retryMs: video.retryMs + audio.retryMs,
    tried,
  };
}

type FinalDecision<Candidate extends string> = Exclude<CodecDecision<Candidate>, { readonly kind: "retry" }>;

function failureOf<Candidate extends string>(decision: Exclude<FinalDecision<Candidate>, { readonly kind: "codec" }>, unsupported: CodecFailure): CodecFailure {
  return decision.kind === "unsupported" ? unsupported : "ENCODER_BUSY";
}

interface LoopContext<Candidate extends string> {
  readonly timing: ProbeTiming;
  readonly tried: string[];
  readonly label: string;
  /** Evidence settled beside the first attempt, read only when that attempt did not encode. */
  readonly alongsideFirst?: Promise<ProbeAttempt<Candidate> | null> | undefined;
}

/** Attempts until the rule decides; the time after the first attempt is the retry cost. */
async function probeUntilDecided<Candidate extends string>(
  policy: ProbePolicy<Candidate>,
  attempt: (candidate: Candidate, deadlineMs: number) => Promise<ProbeOutcome>,
  context: LoopContext<Candidate>,
): Promise<{ readonly decision: FinalDecision<Candidate>; readonly retryMs: number }> {
  const attempts: ProbeAttempt<Candidate>[] = [];
  let firstSettledAt: number | null = null;
  for (;;) {
    const decision = decideCodec(policy, attempts);
    if (decision.kind !== "retry") return { decision, retryMs: firstSettledAt === null ? 0 : context.timing.now() - firstSettledAt };
    if (decision.delayMs > 0) await context.timing.wait(decision.delayMs);
    const outcome = await attempt(decision.candidate, decision.deadlineMs).catch((): ProbeOutcome => "failed");
    attempts.push({ candidate: decision.candidate, outcome });
    context.tried.push(`${context.label} ${decision.candidate}: ${outcome}`);
    if (firstSettledAt !== null) continue;
    if (outcome !== "encoded") {
      const evidence = await context.alongsideFirst;
      if (evidence !== null && evidence !== undefined) attempts.push(evidence);
    }
    firstSettledAt = context.timing.now();
  }
}

/** The outcome of `work`, or "timeout" when the deadline wins; a rejection is a failure. */
export async function settleWithin(work: Promise<ProbeOutcome>, deadlineMs: number): Promise<ProbeOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<ProbeOutcome>((resolve) => {
    timer = setTimeout(() => resolve("timeout"), Math.max(0, deadlineMs));
  });
  try {
    return await Promise.race([work.catch((): ProbeOutcome => "failed"), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/** The probe of the browser: WebCodecs in this worker. Every encoder is closed, deadline or not. */
export const webCodecsProbe: CodecProbe = {
  async video(choice, deadlineMs) {
    if (typeof VideoEncoder === "undefined") return "refused";
    const config = videoEncoderConfig(choice);
    let chunks = 0;
    let failed = false;
    const encoder = new VideoEncoder({ output: () => void (chunks += 1), error: () => void (failed = true) });
    const work = async (): Promise<ProbeOutcome> => {
      if (!(await VideoEncoder.isConfigSupported(config)).supported) return "refused";
      encoder.configure(config);
      const pixels = new Uint8Array(PROBE_FRAME.width * PROBE_FRAME.height * 4);
      for (let index = 0; index < PROBE_FRAMES; index += 1) {
        const frame = new VideoFrame(pixels, { format: "RGBA", codedWidth: PROBE_FRAME.width, codedHeight: PROBE_FRAME.height, timestamp: (index * 1_000_000) / 30 });
        encoder.encode(frame, { keyFrame: index === 0 });
        frame.close();
      }
      await encoder.flush();
      return !failed && chunks > 0 ? "encoded" : "failed";
    };
    try {
      return await settleWithin(work(), deadlineMs);
    } finally {
      if (encoder.state !== "closed") encoder.close();
    }
  },
  async audio(choice, deadlineMs) {
    if (typeof AudioEncoder === "undefined") return "refused";
    const config = audioEncoderConfig(choice);
    let chunks = 0;
    let failed = false;
    const encoder = new AudioEncoder({ output: () => void (chunks += 1), error: () => void (failed = true) });
    const work = async (): Promise<ProbeOutcome> => {
      if (!(await AudioEncoder.isConfigSupported(config)).supported) return "refused";
      encoder.configure(config);
      const data = new AudioData({
        format: "f32-planar",
        sampleRate: SAMPLE_RATE,
        numberOfFrames: PROBE_AUDIO_FRAMES,
        numberOfChannels: 2,
        timestamp: 0,
        data: new Float32Array(PROBE_AUDIO_FRAMES * 2),
      });
      encoder.encode(data);
      data.close();
      await encoder.flush();
      return !failed && chunks > 0 ? "encoded" : "failed";
    };
    try {
      return await settleWithin(work(), deadlineMs);
    } finally {
      if (encoder.state !== "closed") encoder.close();
    }
  },
};
