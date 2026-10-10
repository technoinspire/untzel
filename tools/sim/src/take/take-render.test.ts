// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm sim --take against the export. The takes are recorded live: the
// worker's TransportHost over the real Transport and PreviewTransport, its worklet clock
// reported on time, the page's TakeRecorder reading the receipts. The renders are the
// export's ExportAudio and writers over the real DSP.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { fnv1a32 } from "@untzel/core";
import { SAMPLES_PER_VIDEO_FRAME } from "@untzel/export/plan";
import { ExportAudio, VIDEO_FADE_FRAMES } from "@untzel/export/render-audio";
import { encodePcm24 } from "@untzel/export/wav";
import { encodeTake, takeSpan, type Take } from "@untzel/take";
import { takeTimeline } from "@untzel/take/replay";
import { describe, expect, it, vi } from "vitest";
import { main, parseArguments } from "../cli";
import { createSimPreviewSink } from "./preview-sink";
import { simRegistry } from "../registry";
import { LiveRig, programOf } from "./take-rig";
import { renderTakeVideoTrack, renderTakeWav, simTakeParts, takeAudio, takePlan } from "./take-render";

const wasmPath = fileURLToPath(new URL("../../../../packages/dsp/dist/untzel_dsp.wasm", import.meta.url));
const hasWasm = existsSync(wasmPath);
const SR = 48_000;
const { instruments } = simRegistry();
const NAMES = instruments.map((manifest) => manifest.name);
const LOOP = "tempo 128\nkick x... x... x... x...\nhat ..x. ..x. ..x. ..x.";
/** Four bars at 128 BPM: 7.5 s. */
const BARS_4_MS = 7_500;
const SONG = "tempo 128\nkick x... x... x... x...\nhat ..x. ..x. ..x. ..x.\nsection a kick hat\nsong a 2";
const NOTE = "lead c4 . . .";
const PAD = "pad Am ~ ~ ~";

/** Sixteen bars from the first sound, with a pattern edit, a gain edit and a new track. */
function editedTake(): Take {
  const rig = new LiveRig();
  rig.load(LOOP);
  rig.runTo(1_100);
  rig.send({ kind: "play", mode: "loop", startBar: null });
  const edits = [
    LOOP.replace("hat ..x. ..x. ..x. ..x.", "hat ..x. ..xx ..x. .xxx"),
    LOOP.replace("hat ..x. ..x. ..x. ..x.", "hat ..x. ..xx ..x. .xxx | gain 0.5"),
    `${LOOP.replace("hat ..x. ..x. ..x. ..x.", "hat ..x. ..xx ..x. .xxx | gain 0.5")}\nbass a1 . . a1 . . c2 .`,
  ];
  const firstSoundMs = ((rig.recorder.firstSoundFrame() ?? 0) * 1_000) / SR;
  for (const [index, text] of edits.entries()) {
    rig.runTo(firstSoundMs + (index + 1) * BARS_4_MS - 300);
    rig.load(text);
  }
  rig.runTo(firstSoundMs + 4 * BARS_4_MS + 25);
  rig.send({ kind: "stop" });
  return rig.finish();
}

function rms(samples: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let index = from; index < to; index += 1) sum += (samples[index] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, to - from));
}

/** The PCM bytes of a WAV written by the export: after the 44-byte header. */
function pcm(bytes: Uint8Array, fromFrame: number, frames: number): Uint8Array {
  return bytes.subarray(44 + fromFrame * 6, 44 + (fromFrame + frames) * 6);
}

describe.skipIf(!hasWasm)("pnpm sim --take", () => {
  const wasm = hasWasm ? new WebAssembly.Module(readFileSync(wasmPath)) : (null as never);
  const options = { wasm, samplePacks: [] };
  const take = editedTake();

  it("writes the Export sheet's WAV: the same samples as ExportAudio with the take in the export worker", async () => {
    const wav = await renderTakeWav(take, options);
    const plan = takePlan(take, "firstSound", "audio");
    expect(plan.musicSeconds).toBeGreaterThanOrEqual(30); // sixteen bars at 128 BPM
    // The worker's parts have no audition; nothing else differs.
    const worker = takeAudio(take, plan, { ...simTakeParts("firstSound"), createPreview: null }, options);
    const music = worker.read(plan.musicFrames);
    expect(wav.frames).toBeGreaterThanOrEqual(plan.musicFrames);
    const compared = plan.musicFrames - 2_400; // the WAV's 50 ms fade-out may reach into the music
    const expected = encodePcm24(music.left.subarray(0, compared), music.right.subarray(0, compared));
    expect(Buffer.from(pcm(wav.bytes, 0, compared)).equals(Buffer.from(expected))).toBe(true);
    expect(rms(music.left, 0, plan.musicFrames)).toBeGreaterThan(0.01);
    expect(worker.counters()).toEqual({ lateDrops: 0, queueDrops: 0, nanResets: 0 });
  }, 180_000);

  it("--from-arm is the same sound shifted, a video's track long to the sample, with the video's fade", async () => {
    const track = renderTakeVideoTrack(take, options);
    const plan = takePlan(take, "arm", "video");
    expect(track.frames).toBe((Math.ceil(plan.musicFrames / 1_600) + 60) * 1_600);
    expect(track.frames).toBe(plan.totalVideoFrames * SAMPLES_PER_VIDEO_FRAME);
    const first = takePlan(take, "firstSound", "audio");
    const wav = await renderTakeWav(take, options);
    const shift = (takeSpan(take, "firstSound")?.startFrame ?? 0) - take.armFrame;
    const compared = first.musicFrames - 2_400;
    expect(Buffer.from(pcm(track.bytes, shift, compared)).equals(Buffer.from(pcm(wav.bytes, 0, compared)))).toBe(true);
    // The last VIDEO_FADE_FRAMES: the unfaded track times a gain from 1 to 0.
    const unfaded = takeAudio(take, plan, simTakeParts("arm"), options).read(track.frames);
    const fadeStart = track.frames - VIDEO_FADE_FRAMES;
    const left = unfaded.left.slice(fadeStart);
    const right = unfaded.right.slice(fadeStart);
    for (let index = 0; index < VIDEO_FADE_FRAMES; index += 1) {
      const gain = (VIDEO_FADE_FRAMES - index) / VIDEO_FADE_FRAMES;
      left[index] = (left[index] ?? 0) * gain;
      right[index] = (right[index] ?? 0) * gain;
    }
    expect(Buffer.from(pcm(track.bytes, fadeStart, VIDEO_FADE_FRAMES)).equals(Buffer.from(encodePcm24(left, right)))).toBe(true);
  }, 180_000);

  /** Renders a take as the export does, and the frames of its activations and audition. */
  function replay(recorded: Take, origin: "firstSound" | "arm") {
    const plan = takePlan(recorded, origin, "audio");
    const activations: number[] = [];
    const previewEnds: number[] = [];
    const audio = new ExportAudio({
      plan,
      module: wasm,
      instruments: NAMES,
      instrumentHashes: NAMES.map((name) => fnv1a32(name)),
      timeline: takeTimeline(recorded, simTakeParts(origin)),
      createPreviewSink: (host, clock) => {
        const sink = createSimPreviewSink(host, clock, NAMES);
        return { ...sink, previewEnded: (atFrame) => (previewEnds.push(atFrame), sink.previewEnded(atFrame)) };
      },
      onActivation: (activation) => activations.push(activation.atFrame),
    });
    return { plan, audio, activations, previewEnds, left: audio.read(plan.musicFrames).left };
  }

  it("after the song ends and 2 s stopped, Play sounds; a Play between the detected and the audible end sounds at the live frame", () => {
    const rig = new LiveRig();
    rig.load(SONG);
    rig.runTo(1_100);
    rig.send({ kind: "play", mode: "song", startBar: null });
    rig.runTo(1_100 + 3_750 + 2_000);
    rig.send({ kind: "play", mode: "song", startBar: null });
    const second = rig.log.activations.at(-1) ?? 0;
    while (rig.log.ends.length < 2) rig.runTo(rig.ms + 25);
    const audibleEnd = second + 2 * ((240 * SR) / 128);
    expect(rig.frame).toBeLessThan(audibleEnd); // detected ahead of the audible end
    rig.runTo(rig.ms + 50);
    expect(rig.frame).toBeLessThan(audibleEnd);
    rig.send({ kind: "play", mode: "song", startBar: null });
    rig.runTo(rig.ms + 2_000);
    rig.send({ kind: "stop" });
    const recorded = rig.finish();
    const { activations, left, audio } = replay(recorded, "firstSound");
    expect(activations).toEqual(rig.log.activations);
    const t0 = audio.startFrame;
    const third = rig.log.activations.at(-1) ?? 0;
    expect(third).toBeGreaterThan(second);
    const quarter = SR / 4;
    expect(rms(left, second - t0, second - t0 + quarter)).toBeGreaterThan(0.01);
    expect(rms(left, third - t0, third - t0 + quarter)).toBeGreaterThan(0.01);
    // Stopped between the first song's end (and its tails) and the second Play.
    const firstEnd = (rig.log.activations[0] ?? 0) + 2 * ((240 * SR) / 128);
    expect(rms(left, firstEnd + SR - t0, second - t0)).toBeLessThan(0.001);
  }, 120_000);

  it("plays an auditionNote at the preview's start frame", () => {
    const rig = new LiveRig(true);
    rig.load(LOOP);
    rig.runTo(1_100);
    rig.send({ kind: "auditionNote", program: programOf(NOTE), midis: [60], seconds: 0.5 });
    rig.runTo(3_000);
    rig.send({ kind: "play", mode: "loop", startBar: null });
    rig.runTo(5_000);
    const recorded = rig.finish();
    const start = rig.log.previewStarts[0] ?? 0;
    const { left, audio } = replay(recorded, "arm");
    const at = start - audio.startFrame;
    expect(at).toBeGreaterThan(0);
    expect(rms(left, 0, at)).toBe(0);
    expect(rms(left, at, at + SR / 10)).toBeGreaterThan(0.001);
  }, 120_000);

  it("leaves the audition slot silent from the stop that ends an audition", () => {
    const rig = new LiveRig(true);
    rig.load(LOOP);
    rig.runTo(1_100);
    rig.send({ kind: "play", mode: "loop", startBar: null });
    rig.runTo(2_100);
    rig.send({ kind: "audition", program: programOf(PAD) });
    rig.runTo(3_100);
    rig.send({ kind: "stop" });
    const stopFrame = rig.frame;
    rig.runTo(5_100);
    const recorded = rig.finish();
    const { left, audio, previewEnds } = replay(recorded, "firstSound");
    expect(rig.log.previewEnds).toEqual([stopFrame]);
    expect(previewEnds).toEqual([stopFrame]);
    const at = stopFrame - audio.startFrame;
    expect(rms(left, at - SR / 2, at)).toBeGreaterThan(0.001);
    expect(rms(left, at + SR / 2, left.length)).toBeLessThan(0.001);
  }, 120_000);

  it("the command writes the WAV, exits 1 for a take that does not replay and 2 for one it cannot read or that is refused", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const directory = mkdtempSync(join(tmpdir(), "untzel-take-"));
    const paths = { repo: directory, wasm: wasmPath };
    const write = (name: string, text: string) => {
      writeFileSync(join(directory, name), text);
      return join(directory, name);
    };
    try {
      const good = write("night.take.json", encodeTake(take));
      const out = join(directory, "out", "night.wav");
      expect(await main(["--take", good, "--out", out, "--no-samples"], paths)).toBe(0);
      expect(readFileSync(out).length).toBe((await renderTakeWav(take, options)).bytes.length);
      expect(await main(["--take", good, "--from-arm", "--no-samples"], paths)).toBe(0);
      expect(existsSync(join(directory, ".cache", "sim", "take-night", "take-from-arm.wav"))).toBe(true);
      const [first, ...rest] = take.entries;
      if (first?.command.kind !== "sounding") throw new Error("the take starts with its text");
      const unplayable = { ...take, entries: [{ ...first, command: { ...first.command, source: { ...first.command.source, insert: `${first.command.source.insert}\nkick: kik x...` } } }, ...rest] };
      expect(await main(["--take", write("bad-text.take.json", encodeTake(unplayable))], paths)).toBe(1);
      expect(errors).toHaveBeenLastCalledWith("sim: take does not replay: UNPLAYABLE_TEXT");
      expect(await main(["--take", write("refused.take.json", "not a take")], paths)).toBe(2);
      expect(errors).toHaveBeenLastCalledWith("sim: take refused: MALFORMED");
      expect(await main(["--take", join(directory, "missing.take.json")], paths)).toBe(2);
      expect(parseArguments(["--take", "a.take.json", "--from-arm"])).toMatchObject({ take: "a.take.json", fromArm: true, file: null });
      expect(() => parseArguments(["--from-arm"])).toThrow(/--take/);
      expect(() => parseArguments(["--take"])).toThrow(/take\.json/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
      vi.restoreAllMocks();
    }
  }, 180_000);
});
