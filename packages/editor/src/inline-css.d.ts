// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Vite's `?inline` CSS import: the stylesheet's text, with its @imports resolved. The
// package compiles without vite/client, so the declaration lives here.
declare module "*.css?inline" {
  const css: string;
  export default css;
}
