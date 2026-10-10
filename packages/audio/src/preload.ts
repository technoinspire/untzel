// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// What can load before the tap (first sound under 1 s): the DSP
// download and its compilation, the transport worker and the worklet script. None needs a gesture or an
// AudioContext. Part of the initial JS, so it imports nothing.

/** Asset URLs resolved by the composition (?url, ?worker&url). */
export interface AudioAssetUrls {
  readonly dsp: string;
  readonly worklet: string;
  readonly worker: string;
}

export interface PreloadedAudio {
  /** compileStreaming of the DSP, begun at page load; compileDsp falls back from it. */
  readonly dsp: Promise<WebAssembly.Module>;
  /** Already loading its script; createEngine takes it. */
  readonly worker: Worker;
}

/** The transport worker. It needs no gesture and no AudioContext. */
export function createTransportWorker(url: string): Worker {
  return new Worker(url, { type: "module", name: "untzel-transport" });
}

/**
 * Starts the downloads while the page loads. Fetching the worklet script lets the
 * gesture's addModule use the HTTP cache; the worklet itself needs the AudioContext,
 * which only the gesture creates. The HTML's preloads serve both fetches.
 */
export function preloadAudio(urls: AudioAssetUrls): PreloadedAudio {
  const dsp = WebAssembly.compileStreaming(fetch(urls.dsp));
  dsp.catch(() => undefined); // compileDsp reports the failure when it is used
  fetch(urls.worklet).catch(() => undefined);
  return { dsp, worker: createTransportWorker(urls.worker) };
}
/**
 * At the tap, once the gesture made the context: the worklet module loads while the boot
 * code still downloads. createEngine's addModule of the same URL then finds it
 * in the context's module map; it also reports a failure.
 */
export function addWorkletEarly(context: AudioContext, url: string): void {
  context.audioWorklet.addModule(url).catch(() => undefined);
}
