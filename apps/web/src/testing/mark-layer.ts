// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Test build only: the brand mark of a file frame as its own layer, drawn by the
// export's drawBrandMark from brandLayout on a transparent canvas of the HD frame (as the
// export prepares it), for the scene lab to composite over the light it replays.
import { brandFont, brandLayout, drawBrandMark, frameSize, type BrandLayout, type VideoFormat } from "@untzel/export";

export interface MarkLayer {
  readonly layout: BrandLayout;
  readonly canvas: OffscreenCanvas;
  /** Unpremultiplied RGBA of the whole frame (getImageData). */
  readonly pixels: Uint8ClampedArray;
}

/** A file format's frame when its size is the HD frame; null for a stage. */
export function formatOf(width: number, height: number): VideoFormat | null {
  for (const format of ["story", "video"] as const) {
    const size = frameSize(format, "hd");
    if (size.width === width && size.height === height) return format;
  }
  return null;
}

/** The mark of the format whose HD frame is `width` × `height`, with the logo served at `logoUrl`. */
export async function markLayer(width: number, height: number, logoUrl: string): Promise<MarkLayer> {
  const format = formatOf(width, height);
  if (format === null) throw new Error("scene lab: the mark needs a story or 16:9 frame");
  const layout = brandLayout(frameSize(format, "hd"));
  await document.fonts.load(brandFont(layout.mark.url.fontPx));
  const logo = await createImageBitmap(await (await fetch(logoUrl)).blob());
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) throw new Error("scene lab: no 2D context");
  drawBrandMark(context, logo, layout);
  logo.close();
  return { layout, canvas, pixels: context.getImageData(0, 0, width, height).data };
}

/** A file frame's still (PNG data URL) with the mark drawn over it, as a PNG blob. */
export async function markedStill(still: string, logoUrl: string): Promise<Blob> {
  // Under the static CSP connect-src is 'self', so fetch refuses a data URL; an
  // image may load it (img-src allows data:), and the bitmap is taken from the image.
  const image = new Image();
  image.src = still;
  await image.decode();
  const picture = await createImageBitmap(image);
  const mark = await markLayer(picture.width, picture.height, logoUrl);
  const canvas = new OffscreenCanvas(picture.width, picture.height);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("scene lab: no 2D context");
  context.drawImage(picture, 0, 0);
  picture.close();
  context.drawImage(mark.canvas, 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}
