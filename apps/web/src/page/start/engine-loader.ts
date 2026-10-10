// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The engine's code (the boot chunk) and its bytes: the DSP, the worker and the worklet
// script start loading here, the boot chunk right after, and a retry loads what failed
// again. Part of the initial JS: boot.ts is reached by import() only.
import { preloadAudio } from "@untzel/audio/preload";
import { canPlay } from "@untzel/audio/unlock";
import type { App, AppOptions } from "../../boot";

export interface EngineLoader {
  /** The engine's code, loaded or loading; a retry replaces it. */
  current(): Promise<App>;
  /** A failed load is loaded again; a loaded engine starts over (App.retry). */
  retry(): void;
}

/** Everything the engine needs from the page but the preloaded bytes, which start here. */
export type EngineLoaderOptions = Omit<AppOptions, "preloaded">;

export function createEngineLoader(options: EngineLoaderOptions): EngineLoader {
  // First: the DSP (and its compile), the worker and the worklet script load alongside the
  // boot code. Not before the catalog awaits: on HTTP/1.1 the boot graph's requests held the
  // first screen's template chunks back by ~1.8 s under Slow 4G (measured).
  const preloaded = canPlay() ? preloadAudio(options.urls) : null;
  const load = (): Promise<App> => {
    const loading = import("../../boot").then(({ createApp }) => createApp({ ...options, preloaded: preloaded ?? preloadAudio(options.urls) }));
    loading.catch((error: unknown) => console.error("Untzel couldn't load its code", error));
    return loading;
  };
  let app = load();
  return {
    current: () => app,
    retry: () => {
      app = app.then(
        (loaded) => {
          loaded.retry();
          return loaded;
        },
        () => load(),
      );
    },
  };
}
