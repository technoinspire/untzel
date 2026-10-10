// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The engine of the ?demo page, passed to the boot by the
// test build only. It keeps the AudioContext the tap unlocked, for the boot's identity and
// close(), but never connects anything to its destination: the output is a gain node with no
// way out, so the test hooks' analysers exist and hear silence. Time is the FrameClock.
import { LoadMeter, SamplePackLoader, decodeWithWebAudio, type Engine, type EngineOptions } from "@untzel/audio/main";
import { PreviewTransport, Transport } from "@untzel/transport";
import { DemoSoundPort } from "./demo-sound-port";
import { FrameClock } from "./frame-clock";

export function createDemoEngine(options: EngineOptions): Promise<Engine> {
  const { context, instruments } = options;
  // The transport runs in the page: the worker the page preloaded is not needed.
  options.worker?.terminate();
  const names = instruments.map((manifest) => manifest.name);
  const clock = new FrameClock();
  const sound = new DemoSoundPort({
    clock,
    instruments: names,
    createTransport: (transportClock, sink) => new Transport({ clock: transportClock, sink }),
    createPreview: (previewClock, sink) => new PreviewTransport({ clock: previewClock, sink }),
  });
  // No pack is ever loaded: nothing on the page sounds, the sim renders the take with them.
  const samples = new SamplePackLoader({ sources: [], instruments: names, decode: decodeWithWebAudio, fetch: (url) => fetch(url), onReady: () => undefined });
  const load = options.meter ?? new LoadMeter(instruments);
  sound.onLoad((program) => load.track(program));
  sound.onStats((stats) => load.observe(stats));
  return Promise.resolve({ sound, clock, load, context, output: context.createGain(), samples });
}
