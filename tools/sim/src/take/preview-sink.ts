// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The DSP's audition slot for a replayed take: each preview call becomes the
// worklet messages the live worker posts (previewMessages), handed to the DspHost at the
// frame being rendered. Nothing goes to a main thread: the simulator has none.
import type { DspHost } from "@untzel/audio/dsp-host";
import { previewMessages, type PreviewCall } from "@untzel/audio/protocol";
import type { PreviewSink } from "@untzel/session";

/** `instruments` are the registry names in instrumentId order, as the DSP was given them. */
export function createSimPreviewSink(host: DspHost, clock: { readonly frame: number }, instruments: readonly string[]): PreviewSink {
  const send = (call: PreviewCall): void => {
    for (const message of previewMessages(call, instruments)) host.receive(message, clock.frame);
  };
  return {
    previewStarted: (track, atFrame) => send({ kind: "started", track, atFrame }),
    previewScheduled: (events, points) => send({ kind: "scheduled", events, points }),
    previewEnded: (atFrame) => send({ kind: "ended", atFrame }),
  };
}
