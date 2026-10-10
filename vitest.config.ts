// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { defineConfig } from "vitest/config";

const nodeProject = (name: string, root: string) => ({
  test: {
    name,
    root,
    environment: "node" as const,
    include: ["src/**/*.test.ts"],
  },
});

export default defineConfig({
  test: {
    projects: [
      nodeProject("core", "packages/core"),
      nodeProject("i18n", "packages/i18n"),
      nodeProject("language", "packages/language"),
      nodeProject("scene", "packages/scene"),
      nodeProject("transport", "packages/transport"),
      nodeProject("session", "packages/session"),
      nodeProject("take", "packages/take"),
      nodeProject("presentation", "packages/presentation"),
      nodeProject("skin-contract", "packages/skin-contract"),
      nodeProject("templates", "packages/templates"),
      nodeProject("instrument-index", "packages/instrument-index"),
      nodeProject("commands", "packages/commands"),
      nodeProject("audio", "packages/audio"),
      nodeProject("skin-booth", "packages/skins/booth"),
      nodeProject("editor", "packages/editor"),
      nodeProject("light", "packages/light"),
      nodeProject("share", "packages/share"),
      nodeProject("export", "packages/export"),
      nodeProject("web", "apps/web"),
      nodeProject("sim", "tools/sim"),
      nodeProject("docs", "tools/docs"),
      nodeProject("i18n-check", "tools/i18n"),
      nodeProject("release", "tools/release"),
      nodeProject("changelog", "tools/changelog"),
      { test: { name: "web-build", root: "apps/web/build", environment: "node" as const, include: ["*.test.ts"] } },
      { test: { name: "headers", root: "tools/headers", environment: "node" as const, include: ["*.test.mjs"] } },
      { test: { name: "harness", root: "tools/harness", environment: "node" as const, include: ["*.test.mjs"] } },
      { test: { name: "budgets", root: "tools/budgets", environment: "node" as const, include: ["*.test.mjs"] } },
      nodeProject("demo", "tools/demo"),
    ],
  },
});
