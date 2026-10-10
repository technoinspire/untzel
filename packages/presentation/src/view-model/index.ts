// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The view model the controls render: types only, plus the empty project. It is
// in the initial JS, so at run time it reaches nothing outside this folder.
import type { PlaybackMode, RangePartNames } from "@untzel/session";
export type * from "./track-view";
export type * from "./transport-view";
export type * from "./song-view";
export type * from "./play-range-view";
export type * from "./library-view";
export type * from "./templates-view";
export type * from "./share-view";
export type * from "./export-view";
export type * from "./project-view";
export type * from "./untzel-view";
export { NO_PROJECT } from "./project-view";
// A source-less re-export: dependency-cruiser types every `export … from` as a run-time
// edge, never type-only.
export type { PlaybackMode, RangePartNames };
