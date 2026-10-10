// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test build only (loaded by the test hooks behind import.meta.env.MODE): the scene tests'
// bench. It records what the page's light relay receives while the music plays (the
// program, the audibility changes and every cue batch, as the live stage gets them), then
// replays the recording into OfflineStages, the export's own stage: the same composer,
// FrameDriver, limiter clock and WebGL2 passes as the screen and the file. Frames are read
// back as pixels after the final pass (after the trail, the bloom, the tone map and the
// limiter's gain, before any brand mark) and measured by frame-stats.ts.
import { brandLayout, frameSize } from "@untzel/export";
import { exportKeepOut } from "@untzel/export/brand-exclusion";
import { TOP_CHROME_KEEP_OUT_Y } from "@untzel/scene";
import type { AudibilityChange, LightCue, LightProgram, LightTimeline } from "@untzel/light";
import { createOfflineStage, fitScene, sceneSquare, type OfflineStage } from "@untzel/light/offline";
import type { LightRelay } from "../page/light-relay";
import { stageKeepOut } from "../stage/stage-keep-out";
import { zoneEllipse } from "@untzel/light/testing";
import { STAGE_Y, frameStats, luminanceOf, type FrameGeometry, type FrameStats, type PixelBox } from "./frame-stats";
import { markContrast, type MarkContrast } from "./mark-contrast";
import { formatOf, markLayer, markedStill as markedStillBlob, type MarkLayer } from "./mark-layer";
export { compareVideos, type VideoComparison } from "./video-compare";

interface Batch {
  readonly cues: readonly LightCue[];
  readonly timeline: LightTimeline;
}

interface Recording {
  program: LightProgram | null;
  readonly changes: AudibilityChange[];
  readonly batches: Batch[];
}

let recording: Recording = { program: null, changes: [], batches: [] };
let isWrapped = false;

/** From now on, a copy of what the relay is handed; a new call starts a new recording. */
export function startRecording(relay: LightRelay): void {
  recording = { program: null, changes: [], batches: [] };
  if (isWrapped) return;
  isWrapped = true;
  const { setProgram, setAudibility, schedule } = relay;
  relay.setProgram = (program) => {
    recording = { program, changes: [], batches: recording.batches };
    setProgram.call(relay, program);
  };
  relay.setAudibility = (change) => {
    recording.changes.push(change);
    setAudibility.call(relay, change);
  };
  relay.schedule = (cues, timeline) => {
    recording.batches.push({ cues, timeline });
    schedule.call(relay, cues, timeline);
  };
}

/** The audio-time span the recording covers, and when its program took effect (null: none yet). */
export function recordedSpan(): { readonly from: number; readonly to: number; readonly programAt: number | null } {
  const times = recording.batches.flatMap((batch) => [batch.timeline.audioTime, ...batch.cues.map((cue) => cue.audioTime)]);
  return { from: Math.min(...times), to: Math.max(...times), programAt: recording.program?.audioTime ?? null };
}

export type Surface = "screen" | "file";

export interface LabRun {
  readonly width: number;
  readonly height: number;
  readonly surface: Surface;
  readonly reducedMotion: boolean;
  readonly from: number;
  readonly seconds: number;
  readonly fps: number;
  readonly renderer?: "webgl2" | "2d";
  /** Instants (seconds after `from`) whose frame comes back as a PNG data URL. */
  readonly stills?: readonly number[];
  /** Measure the pixels of every frame (else only the stills and the timing). */
  readonly measure?: boolean;
  /** With `measure`, a file frame's brand mark drawn with this logo, its contrast read on every frame. */
  readonly markLogoUrl?: string;
}

export interface LabResult {
  readonly kind: "webgl2" | "2d";
  readonly frames: readonly FrameStats[];
  readonly stills: readonly string[];
  /** Milliseconds of each frame's work: the draw plus a 1-pixel read-back that waits for the GPU. */
  readonly workMs: readonly number[];
  /** fnv-1a of every frame's bytes, for the determinism test. */
  readonly hashes: readonly number[];
  /** The mark's contrast over each measured frame (empty without `markLogoUrl`). */
  readonly marks: readonly MarkContrast[];
}

/** Where the line, the veils and the brand zones fall on this frame, from the same sources the stage uses. */
export function geometryOf(width: number, height: number, surface: Surface): FrameGeometry {
  const { unit } = sceneSquare(fitScene({ width, height }));
  const toRow = (u: number) => (0.5 + u * unit) * height;
  const toColumn = (u: number) => width / 2 + u * unit * height;
  const keepOut = surface === "file" ? exportKeepOut() : stageKeepOut();
  const grow = (u: number) => u * unit * height;
  const zones = keepOut.brandZones.map((zone) => zoneEllipse({ minX: toColumn(zone.minX), maxX: toColumn(zone.maxX), minY: toRow(zone.minY), maxY: toRow(zone.maxY) }));
  const format = formatOf(width, height);
  const scrim = format === null ? null : brandLayout(frameSize(format, "hd")).mark.scrim;
  const veils: PixelBox[] = scrim === null ? [] : [{ x0: scrim.x, y0: scrim.y, x1: scrim.x + scrim.w, y1: scrim.y + scrim.h }];
  // The lit share leaves out the veil plus 18 px.
  const excluded = veils.map((veil) => ({ x0: veil.x0 - 18, y0: veil.y0 - 18, x1: veil.x1 + 18, y1: veil.y1 + 18 }));
  return { lineRow: toRow(TOP_CHROME_KEEP_OUT_Y), tenthUnit: grow(0.1), excluded, veils, zones };
}

function replayInto(stage: OfflineStage): void {
  if (recording.program !== null) stage.setProgram(recording.program);
  for (const change of recording.changes) stage.setAudibility(change);
  for (const batch of recording.batches) stage.schedule(batch.cues, batch.timeline);
}

function fnv1a(data: Uint8ClampedArray): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < data.length; index += 1) hash = Math.imul(hash ^ (data[index] ?? 0), 0x01000193);
  return hash >>> 0;
}

async function dataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return `data:image/png;base64,${btoa(binary)}`;
}

/** One frame's luminance at `t` on a fresh stage, with the surface's keep-out or without its brand zones. */
function frameLuminanceAt(width: number, height: number, surface: Surface, t: number, withZones: boolean): Float32Array {
  const canvas = new OffscreenCanvas(width, height);
  const keepOut = surface === "file" ? exportKeepOut() : stageKeepOut();
  const stage = createOfflineStage({ canvas, reducedMotion: false, keepOut: withZones ? keepOut : { ...keepOut, brandZones: [] } });
  if (stage === null) throw new Error("scene lab: no renderer");
  replayInto(stage);
  // The trail's pre-roll and the limiter's catch-up, as the export does before its first frame.
  stage.drawAt(t);
  const read = new OffscreenCanvas(width, height).getContext("2d", { willReadFrequently: true });
  if (read === null) throw new Error("scene lab: no 2D context");
  read.drawImage(canvas, 0, 0);
  stage.destroy();
  return luminanceOf(read.getImageData(0, 0, width, height).data, width, height);
}

/**
 * The brand zones' edge on the final pixels: the same instant drawn with the
 * zones and without them. Their ratio is the share of light the mask keeps, figures and all
 * cancelled, and the step it makes is |Δkeep| × the light between neighbouring pixels,
 * within each zone grown by 0.2 u, where the tone map is linear. Returns the largest step.
 */
export function maskEdgeStep(width: number, height: number, surface: Surface, t: number): number {
  const kept = frameLuminanceAt(width, height, surface, t, true);
  const open = frameLuminanceAt(width, height, surface, t, false);
  const { zones } = geometryOf(width, height, surface);
  const { unit } = sceneSquare(fitScene({ width, height }));
  const grow = 0.2 * unit * height;
  // The light over the stage's own colour, where there is enough to divide by and the tone
  // map is still linear (its knee bends the brightest strokes, which would not cancel).
  const light = (values: Float32Array, index: number) => (values[index] ?? 0) - STAGE_Y;
  const keepAt = (index: number) => {
    const lit = light(open, index);
    return lit > 0.05 && lit < 0.2 ? Math.min(1, Math.max(0, light(kept, index) / lit)) : null;
  };
  let worst = 0;
  for (const zone of zones) {
    const x0 = Math.max(0, Math.floor(zone.centerX - zone.radiusX - grow));
    const x1 = Math.min(width - 1, Math.ceil(zone.centerX + zone.radiusX + grow));
    const y0 = Math.max(0, Math.floor(zone.centerY - zone.radiusY - grow));
    const y1 = Math.min(height - 1, Math.ceil(zone.centerY + zone.radiusY + grow));
    for (let py = y0; py < y1; py += 1) {
      for (let px = x0; px < x1; px += 1) {
        const index = py * width + px;
        const here = keepAt(index);
        if (here === null) continue;
        for (const next of [index + 1, index + width]) {
          const there = keepAt(next);
          if (there !== null) worst = Math.max(worst, Math.abs(here - there) * Math.max(light(open, index), light(open, next)));
        }
      }
    }
  }
  return worst;
}

/** A file frame's still with the brand mark drawn over it the way the export draws it, as a PNG data URL. */
export async function markedStill(still: string, logoUrl: string): Promise<string> {
  return dataUrl(await markedStillBlob(still, logoUrl));
}

/** Replays the recording into a fresh OfflineStage and draws `seconds` × `fps` frames from `from`. */
export async function runLab(run: LabRun): Promise<LabResult> {
  const canvas = new OffscreenCanvas(run.width, run.height);
  const keepOut = run.surface === "file" ? exportKeepOut() : stageKeepOut();
  const stage = createOfflineStage({ canvas, reducedMotion: run.reducedMotion, keepOut, prefer: run.renderer ?? "webgl2" });
  if (stage === null) throw new Error("scene lab: no renderer");
  replayInto(stage);
  const read = new OffscreenCanvas(run.width, run.height).getContext("2d", { willReadFrequently: true });
  if (read === null) throw new Error("scene lab: no 2D context");
  const geometry = geometryOf(run.width, run.height, run.surface);
  const stillFrames = new Set((run.stills ?? []).map((seconds) => Math.round(seconds * run.fps)));
  const frames: FrameStats[] = [];
  const stills: string[] = [];
  const workMs: number[] = [];
  const hashes: number[] = [];
  const mark = run.measure === true && run.markLogoUrl !== undefined ? await markLayer(run.width, run.height, run.markLogoUrl) : null;
  const marks: MarkContrast[] = [];
  const count = Math.round(run.seconds * run.fps);
  for (let frame = 0; frame < count; frame += 1) {
    const started = performance.now();
    stage.drawAt(run.from + frame / run.fps);
    read.drawImage(canvas, 0, 0, 1, 1, 0, 0, 1, 1);
    read.getImageData(0, 0, 1, 1);
    workMs.push(performance.now() - started);
    if (run.measure !== true && !stillFrames.has(frame)) continue;
    read.drawImage(canvas, 0, 0);
    const pixels = read.getImageData(0, 0, run.width, run.height).data;
    hashes.push(fnv1a(pixels));
    if (run.measure === true) frames.push(frameStats(pixels, run.width, run.height, geometry));
    if (mark !== null) marks.push(contrastOver(pixels, mark));
    if (stillFrames.has(frame)) stills.push(await dataUrl(await read.canvas.convertToBlob({ type: "image/png" })));
  }
  const kind = stage.kind;
  stage.destroy();
  return { kind, frames, stills, workMs, hashes, marks };
}

/** The mark's layer over one frame of light: ink present, and its worst contrast. */
function contrastOver(pixels: Uint8ClampedArray, mark: MarkLayer): MarkContrast {
  const { logo, url } = mark.layout.mark;
  return markContrast(pixels, mark.pixels, mark.canvas.width, logo, url.rect);
}
