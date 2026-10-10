// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The screen the demo is captured on, per format: a CSS
// viewport the app lays out for, and the device pixel ratio that gives the video's size.
// Story is a phone held upright; Video and 4K are the same 16:9 desktop, at two densities.
export type CaptureFormatName = "story" | "video" | "4k";

export interface CaptureFormat {
  readonly name: CaptureFormatName;
  /** CSS pixels. */
  readonly viewport: { readonly width: number; readonly height: number };
  readonly deviceScaleFactor: number;
  /** The video's frame: viewport × deviceScaleFactor. */
  readonly frame: { readonly width: number; readonly height: number };
}

function format(name: CaptureFormatName, width: number, height: number, deviceScaleFactor: number): CaptureFormat {
  return {
    name,
    viewport: { width, height },
    deviceScaleFactor,
    frame: { width: Math.round(width * deviceScaleFactor), height: Math.round(height * deviceScaleFactor) },
  };
}

export const CAPTURE_FORMATS: Readonly<Record<CaptureFormatName, CaptureFormat>> = {
  story: format("story", 405, 720, 8 / 3),
  video: format("video", 1440, 810, 4 / 3),
  "4k": format("4k", 1440, 810, 8 / 3),
};

/** The format named on the command line; null for another word. */
export function captureFormat(name: string): CaptureFormat | null {
  return Object.hasOwn(CAPTURE_FORMATS, name) ? CAPTURE_FORMATS[name as CaptureFormatName] : null;
}
