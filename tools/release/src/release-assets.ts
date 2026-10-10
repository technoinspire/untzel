// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// File names of a release: the two assets of the GitHub release and the dispatch body
// (written next to them, never uploaded).

export interface ReleaseAssetNames {
  readonly archive: string;
  readonly manifest: string;
  readonly dispatch: string;
}

export function releaseAssetNames(version: string): ReleaseAssetNames {
  return {
    archive: `untzel-${version}.tar.gz`,
    manifest: `untzel-${version}.manifest.json`,
    dispatch: `untzel-${version}.dispatch.json`,
  };
}
