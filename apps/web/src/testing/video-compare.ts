// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test build only: two exported MP4s decoded side by side and compared pixel by pixel, for
// the check "two exports of the same text have equal frames" (export-frames).
import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from "mediabunny";

export interface VideoComparison {
  readonly framesA: number;
  readonly framesB: number;
  /** The largest per-frame mean of |a − b| over the RGB bytes. */
  readonly worstFrameMean: number;
  /** The mean of |a − b| over every frame. */
  readonly mean: number;
  /** The largest |a − b| of any byte. */
  readonly worstByte: number;
}

/** Decodes two MP4s frame by frame and compares their pixels (the export-frames test). */
// Over 40 lines: test build only; two decoders read in step, frame by frame.
export async function compareVideos(a: Blob, b: Blob): Promise<VideoComparison> {
  const open = async (file: Blob) => {
    const track = await new Input({ source: new BlobSource(file), formats: ALL_FORMATS }).getPrimaryVideoTrack();
    if (track === null) throw new Error("scene lab: no video track");
    return { track, frames: new VideoSampleSink(track).samples()[Symbol.asyncIterator]() };
  };
  const [first, second] = await Promise.all([open(a), open(b)]);
  const { displayWidth: width, displayHeight: height } = first.track;
  const contexts = [0, 1].map(() => new OffscreenCanvas(width, height).getContext("2d", { willReadFrequently: true }));
  const [left, right] = contexts;
  if (left == null || right == null) throw new Error("scene lab: no 2D context");
  let framesA = 0;
  let framesB = 0;
  let worstFrameMean = 0;
  let total = 0;
  let worstByte = 0;
  for (;;) {
    const [one, two] = await Promise.all([first.frames.next(), second.frames.next()]);
    if (!one.done) framesA += 1;
    if (!two.done) framesB += 1;
    if (one.done || two.done) {
      one.value?.close();
      two.value?.close();
      break;
    }
    one.value.draw(left, 0, 0, width, height);
    two.value.draw(right, 0, 0, width, height);
    one.value.close();
    two.value.close();
    const pa = left.getImageData(0, 0, width, height).data;
    const pb = right.getImageData(0, 0, width, height).data;
    let sum = 0;
    for (let index = 0; index < pa.length; index += 1) {
      if (index % 4 === 3) continue;
      const difference = Math.abs((pa[index] ?? 0) - (pb[index] ?? 0));
      sum += difference;
      if (difference > worstByte) worstByte = difference;
    }
    const frameMean = sum / (width * height * 3);
    total += frameMean;
    worstFrameMean = Math.max(worstFrameMean, frameMean);
  }
  return { framesA, framesB, worstFrameMean, mean: total / Math.max(1, Math.min(framesA, framesB)), worstByte };
}

