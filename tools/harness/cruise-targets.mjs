// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The one list of folders dependency-cruiser reads: the deps step of pnpm check and
// pnpm lint:deps (tools/harness/cruise.mjs) cruise the same tree.
export const CRUISE_TARGETS = ["packages", "instruments", "apps", "tools/sim", "tools/docs", "tools/i18n", "tools/release", "tools/changelog", "tools/demo"];
