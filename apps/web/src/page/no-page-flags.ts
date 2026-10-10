// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { PageFlags } from "@untzel/ui-preview/page-flags";

/** Production: no flag is ever read, and the dev-only flag reader is never loaded. */
export const NO_PAGE_FLAGS: PageFlags = {
  sim: false,
  screen: null,
  stress: null,
  stressEngine: null,
  renderer: null,
  reducedMotion: false,
  seed: null,
  template: null,
  still: false,
  wireframe: false,
  demo: false,
};
