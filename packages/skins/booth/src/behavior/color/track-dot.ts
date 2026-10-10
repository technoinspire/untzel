// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { trackColorIndex } from "@untzel/core";

// The 8 px dot of a track tile and table row: the track's color, the same one its name
// and gutter bar have in the code and its light layer's hue.

export function trackDotClass(name: string): string {
  return `ui-track-dot ui-track-dot--${trackColorIndex(name)}`;
}
