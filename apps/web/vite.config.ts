// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { appVersion } from "./build/app-version";
import { enginePreload } from "./build/engine-preload";
import { workerLicenses } from "./build/worker-licenses";
/** Help → About shows it: the release's version from its tag, else the package's. */
const PACKAGE_VERSION = (JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }).version;
const VERSION = appVersion(process.env["UNTZEL_VERSION"], PACKAGE_VERSION);
/** The license notices of every bundled dependency, at the root of the output next to
 * index.html (THIRD_PARTY.md, "Bundled libraries"; MIT asks the notice to travel with every
 * copy). Vite writes the main bundle's; workerLicenses adds what only a worker bundles. */
const LICENSE_FILE = "third-party-licenses.md";

// base "./": the app is served at the root of app.untzel.com; relative URLs
// keep any preview path working as well. assetsInlineLimit 0 keeps the WASM, the worklet
// and the worker as hashed files (measured). The test build (test hooks,
// page flags) goes to dist-test/, so dist/ only ever holds production output.
export default defineConfig(({ mode }) => {
  const licenses = workerLicenses(LICENSE_FILE);
  return {
    base: "./",
    define: { __UNTZEL_VERSION__: JSON.stringify(VERSION) },
    // The engine's bytes start with the HTML, at low priority.
    plugins: [enginePreload(), licenses.main],
    worker: {
      format: "es",
      plugins: () => [licenses.worker()],
    },
    build: {
      target: "es2023",
      assetsInlineLimit: 0,
      // Every engine the app runs on (Chrome 154, WebKit 26, Firefox 155) has native
      // modulepreload: the polyfill only weighed on the initial JS (68 KB budget).
      modulePreload: { polyfill: false },
      manifest: true,
      license: { fileName: LICENSE_FILE },
      outDir: mode === "test" ? "dist-test" : "dist",
    },
  };
});
