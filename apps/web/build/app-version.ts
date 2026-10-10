// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The version Help → About shows. A release builds with UNTZEL_VERSION set from its tag
// (the tag is the only authority of version), so the first release reads
// 0.1.0, not the workspace's 0.0.0. Any other build shows the package's own version.
const STABLE_SEMVER = /^\d+\.\d+\.\d+$/;

export function appVersion(fromRelease: string | undefined, fromPackage: string): string {
  if (fromRelease === undefined || fromRelease === "") return fromPackage;
  if (!STABLE_SEMVER.test(fromRelease)) throw new Error(`UNTZEL_VERSION must be MAJOR.MINOR.PATCH, got "${fromRelease}"`);
  return fromRelease;
}
