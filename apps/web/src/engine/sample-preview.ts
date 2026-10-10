// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The auditions' preview path over the engine. Part of the boot chunk.
import type { Engine } from "@untzel/audio/main";
import type { PreviewPort } from "@untzel/session";

/** The audition, which also loads the samples of the instrument it plays. */
export function withSamplesFor(engine: Engine): PreviewPort {
  const { sound, samples } = engine;
  return {
    preview: (program) => {
      samples.want(program);
      sound.preview(program);
    },
    previewNote: (program, midis, seconds) => {
      samples.want(program);
      sound.previewNote(program, midis, seconds);
    },
    stopPreview: () => sound.stopPreview(),
    onPreviewEnded: (listener) => sound.onPreviewEnded(listener),
  };
}
