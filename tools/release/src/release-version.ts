// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The tag is the only version authority: stable SemVer, no pre-release, no build.
// v0.0.0 is reserved for the rehearsal: a pushed tag never uses it, and a rehearsal
// never uses anything else.

const RELEASE_TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const REHEARSAL_TAG = "v0.0.0";

export type ReleaseSource = "tag" | "rehearsal";
export const RELEASE_SOURCES: readonly ReleaseSource[] = ["tag", "rehearsal"];

export interface ReleaseVersion {
  readonly tag: string;
  readonly version: string;
}

export function parseReleaseTag(tag: string): ReleaseVersion {
  if (!RELEASE_TAG.test(tag)) {
    throw new Error(`"${tag}" is not a release tag: expected vMAJOR.MINOR.PATCH (stable SemVer, no leading zeros, no pre-release or build)`);
  }
  return { tag, version: tag.slice(1) };
}

export function parseSourcedReleaseTag(tag: string, source: ReleaseSource): ReleaseVersion {
  const release = parseReleaseTag(tag);
  if (source === "tag" && tag === REHEARSAL_TAG) {
    throw new Error(`${REHEARSAL_TAG} is reserved for the rehearsal: it is never pushed as a tag`);
  }
  if (source === "rehearsal" && tag !== REHEARSAL_TAG) {
    throw new Error(`a rehearsal packages ${REHEARSAL_TAG}, not "${tag}"`);
  }
  return release;
}
