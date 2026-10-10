// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { defineConfig } from "vite";

// Development preview only; never deployed.
export default defineConfig({
  server: { port: 5199, strictPort: true },
  build: { target: "es2023" },
});
