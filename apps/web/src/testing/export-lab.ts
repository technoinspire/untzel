// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test build only (loaded by the test hooks behind import.meta.env.MODE): reads an
// exported MP4 or WAV back in the browser, with Mediabunny's reader, and measures the
// brand mark on the light and the closing card per rectangle against their references,
// at the file's own size (every format and tier).
import {
  CARD_FONT,
  LOGO_RECT,
  MARK_URL_BASELINE,
  MARK_URL_FONT,
  MARK_URL_RECT,
  CARD_URL,
  REFERENCE_SIZE,
  URL_RECT,
  brandFont,
  brandLayout,
  drawBrandMark,
  drawClosingCard,
  frameSize,
  measureTextBox,
  measureUrlBox,
  type CardRect,
  type ExportQuality,
  type FrameSize,
  type MarkPlacement,
  type VideoFormat,
} from "@untzel/export";
import { drawCardForTest } from "@untzel/export/testing";
import { ALL_FORMATS, AudioSampleSink, BlobSource, EncodedPacketSink, Input } from "mediabunny";
import { glowPixelsInRings, markPixelsInRings } from "./mark-clearance";
import { titleReferences, type TitleText } from "./title-check";
import { checkVideoFrames, meanError, type FrameReferences, type VideoFramesReport } from "./video-frames-check";

export { meanError } from "./video-frames-check";

/** A kick attack: the first sample this loud. */
const ATTACK_LEVEL = 0.05;

export interface CardReferences extends FrameReferences {
  readonly fontReady: boolean;
}

export interface Mp4Report extends VideoFramesReport {
  readonly width: number;
  readonly height: number;
  readonly videoCodec: string | null;
  readonly audioCodec: string | null;
  readonly videoFrames: number;
  readonly firstVideoTimestamp: number;
  readonly lastVideoTimestamp: number;
  readonly sampleRate: number;
  readonly channels: number;
  readonly audioFrames: number;
  /** Timestamp of the first decoded audio sample: the encoder delay moved earlier, ≤ 0. */
  readonly firstAudioTimestamp: number;
  /** Seconds from the start of the file to the first attack of the decoded sound. */
  readonly firstAttackSeconds: number | null;
  readonly comment: string | null;
  /** The MP4's title tag: the song's title. */
  readonly songTitle: string | null;
  /** Where the file's layout puts the mark: "centred" (story) or "corner" (16:9). */
  readonly markPlacement: MarkPlacement;
  /** The mark's scrim in the file's layout: no title may reach into it. */
  readonly markScrim: CardRect;
  /** Pixels of the mark (scrim included) inside the rings' design disc; 0 in the corner. */
  readonly markPixelsInRings: number;
}

export interface WavReport {
  readonly riff: string;
  readonly riffSize: number;
  readonly fileSize: number;
  readonly channels: number;
  readonly sampleRate: number;
  readonly bitsPerSample: number;
  readonly dataBytes: number;
  readonly frames: number;
  readonly info: string;
  readonly firstAttackSeconds: number | null;
  /** fnv-1a of the PCM bytes of the first `hashFrames` frames. */
  readonly pcmHash: number;
}

export async function cardReferences(logoUrl: string, size: FrameSize = REFERENCE_SIZE): Promise<CardReferences> {
  const layout = brandLayout(size);
  const fonts = [layout.card.url.fontPx, layout.mark.url.fontPx].map(brandFont);
  await Promise.all(fonts.map((font) => document.fonts.load(font)));
  const fontReady = fonts.every((font) => document.fonts.check(font));
  const logo = await createImageBitmap(await (await fetch(logoUrl)).blob());
  const draw = (paint: (ctx: OffscreenCanvasRenderingContext2D) => void): ImageData => {
    const canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (ctx === null) throw new Error("no 2D context");
    paint(ctx);
    return ctx.getImageData(0, 0, size.width, size.height);
  };
  const references = {
    layout,
    card: draw((ctx) => drawClosingCard(ctx, logo, layout)),
    noLogo: draw((ctx) => drawCardForTest(ctx, logo, layout, "logo")),
    noUrl: draw((ctx) => drawCardForTest(ctx, logo, layout, "url")),
    markOnBlack: draw((ctx) => drawBrandMark(ctx, logo, layout)),
    fontReady,
  };
  logo.close();
  return references;
}

interface TextFit {
  readonly box: CardRect;
  readonly rect: CardRect;
}

/** The canvas half of the card and mark tests: controls per rectangle and the measured text boxes. */
export async function checkCardCanvas(logoUrl: string): Promise<{
  readonly fontReady: boolean;
  readonly logoVsNoLogo: number;
  readonly urlVsNoUrl: number;
  readonly url: TextFit;
  readonly markUrl: TextFit;
}> {
  const references = await cardReferences(logoUrl);
  const ctx = new OffscreenCanvas(REFERENCE_SIZE.width, REFERENCE_SIZE.height).getContext("2d");
  if (ctx === null) throw new Error("no 2D context");
  return {
    fontReady: references.fontReady,
    logoVsNoLogo: meanError(references.card, references.noLogo, LOGO_RECT),
    urlVsNoUrl: meanError(references.card, references.noUrl, URL_RECT),
    url: { box: measureUrlBox(ctx), rect: URL_RECT },
    markUrl: { box: measureTextBox(ctx, CARD_URL, MARK_URL_FONT, MARK_URL_BASELINE), rect: MARK_URL_RECT },
  };
}

/**
 * The 16:9 mark drawn alone on a transparent frame of `quality`, as the file's mark layer:
 * its pixels with any alpha inside the rings' disc, and, as the positive control, the same
 * mark with the glow's cut left out.
 */
export async function cornerGlowInRings(logoUrl: string, quality: ExportQuality): Promise<{ readonly cut: number; readonly uncut: number }> {
  const layout = brandLayout(frameSize("video", quality));
  const logo = await createImageBitmap(await (await fetch(logoUrl)).blob());
  const count = (drawnLayout: typeof layout): number => {
    const canvas = new OffscreenCanvas(layout.size.width, layout.size.height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx === null) throw new Error("no 2D context");
    drawBrandMark(ctx, logo, drawnLayout);
    return glowPixelsInRings(ctx.getImageData(0, 0, layout.size.width, layout.size.height));
  };
  try {
    return { cut: count(layout), uncut: count({ ...layout, mark: { ...layout.mark, ringsClearance: null } }) };
  } finally {
    logo.close();
  }
}
/** The frame rectangles the sheet's preview must reproduce, over the format's HD frame. */
export function previewGeometry(format: VideoFormat = "story"): {
  readonly size: FrameSize;
  readonly rects: Readonly<Record<"markLogo" | "scrim" | "cardLogo", CardRect>>;
  /** The axis the mark's URL is centred on, in frame pixels. */
  readonly markUrlCenter: number;
} {
  const size = frameSize(format, "hd");
  const { mark, card } = brandLayout(size);
  return { size, rects: { markLogo: mark.logo, scrim: mark.scrim, cardLogo: card.logo }, markUrlCenter: mark.centerX };
}

/** With `title`, every frame is also held to the song's title card and caption. */
export async function inspectMp4(file: Blob, logoUrl: string, title: TitleText | null = null): Promise<Mp4Report> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  const audio = await input.getPrimaryAudioTrack();
  if (video === null || audio === null) throw new Error("the MP4 needs a video and an audio track");
  const timestamps: number[] = [];
  for await (const packet of new EncodedPacketSink(video).packets()) timestamps.push(packet.timestamp);
  timestamps.sort((a, b) => a - b);
  const sound = await inspectAudio(audio);
  const size = { width: video.displayWidth, height: video.displayHeight };
  const references = await cardReferences(logoUrl, size);
  const frames = await checkVideoFrames(video, timestamps.length, references, title === null ? null : await titleReferences(size, title));
  const tags = await input.getMetadataTags();
  const report: Mp4Report = {
    width: video.displayWidth,
    height: video.displayHeight,
    videoCodec: video.codec,
    audioCodec: audio.codec,
    videoFrames: timestamps.length,
    firstVideoTimestamp: timestamps[0] ?? Number.NaN,
    lastVideoTimestamp: timestamps.at(-1) ?? Number.NaN,
    sampleRate: audio.sampleRate,
    channels: audio.numberOfChannels,
    ...sound,
    comment: tags.comment ?? null,
    songTitle: tags.title ?? null,
    markPlacement: references.layout.mark.placement,
    markScrim: references.layout.mark.scrim,
    markPixelsInRings: markPixelsInRings(references.markOnBlack),
    ...frames,
  };
  input.dispose();
  return report;
}

async function inspectAudio(audio: ConstructorParameters<typeof AudioSampleSink>[0]) {
  let audioFrames = 0;
  let firstAudioTimestamp = Number.NaN;
  let firstAttackSeconds: number | null = null;
  for await (const sample of new AudioSampleSink(audio).samples()) {
    if (Number.isNaN(firstAudioTimestamp)) firstAudioTimestamp = sample.timestamp;
    const channel = new Float32Array(sample.numberOfFrames);
    sample.copyTo(channel, { planeIndex: 0, format: "f32-planar" });
    if (firstAttackSeconds === null) {
      const index = channel.findIndex((value) => Math.abs(value) >= ATTACK_LEVEL);
      if (index >= 0) firstAttackSeconds = sample.timestamp + index / sample.sampleRate;
    }
    audioFrames += sample.numberOfFrames;
    sample.close();
  }
  return { audioFrames, firstAudioTimestamp, firstAttackSeconds };
}

export async function inspectWav(file: Blob, hashFrames: number): Promise<WavReport> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const ascii = (from: number, length: number) => String.fromCharCode(...bytes.subarray(from, from + length));
  const dataBytes = view.getUint32(40, true);
  const frames = dataBytes / 6;
  let firstAttackSeconds: number | null = null;
  for (let frame = 0; frame < frames; frame += 1) {
    const offset = 44 + frame * 6;
    const raw = (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
    const value = (raw << 8) >> 8;
    if (Math.abs(value / 8_388_607) >= ATTACK_LEVEL) {
      firstAttackSeconds = frame / view.getUint32(24, true);
      break;
    }
  }
  let hash = 0x811c9dc5;
  for (let offset = 44; offset < 44 + Math.min(frames, hashFrames) * 6; offset += 1) {
    hash = Math.imul(hash ^ (bytes[offset] ?? 0), 0x01000193) >>> 0;
  }
  return {
    riff: ascii(0, 4) + ascii(8, 4),
    riffSize: view.getUint32(4, true),
    fileSize: bytes.length,
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    bitsPerSample: view.getUint16(34, true),
    dataBytes,
    frames,
    info: new TextDecoder().decode(bytes.subarray(44 + dataBytes)),
    firstAttackSeconds,
    pcmHash: hash,
  };
}
