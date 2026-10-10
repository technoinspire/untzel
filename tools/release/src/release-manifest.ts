// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The release manifest: every file of the archive with
// its SHA-256 and size, and the SHA-256 of the archive itself. A contract with the site.
import { createHash } from "node:crypto";
import { compareByPath } from "./path-order";
import type { ReleaseVersion } from "./release-version";

export interface ManifestFile {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface ReleaseManifest {
  readonly version: string;
  readonly tag: string;
  readonly commit: string;
  readonly createdAt: string;
  readonly files: readonly ManifestFile[];
  readonly archiveSha256: string;
}

export interface ManifestInput {
  readonly release: ReleaseVersion;
  readonly commit: string;
  readonly createdAt: string;
  readonly files: readonly ManifestFile[];
  readonly archiveSha256: string;
}

const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function sha256Hex(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export function manifestFile(path: string, content: Uint8Array): ManifestFile {
  return { path, sha256: sha256Hex(content), bytes: content.length };
}

/** An ISO 8601 time with offset (git's %cI) as UTC to the second: YYYY-MM-DDTHH:MM:SSZ. */
export function normalizeCreatedAt(value: string): string {
  const time = ISO_TIME.test(value) ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(time)) throw new Error(`"${value}" is not an ISO 8601 time with an offset (git show -s --format=%cI)`);
  return `${new Date(time).toISOString().slice(0, 19)}Z`;
}

export function buildManifest(input: ManifestInput): ReleaseManifest {
  if (!COMMIT.test(input.commit)) throw new Error(`"${input.commit}" is not a full lowercase commit SHA (40 hex digits)`);
  if (!SHA256.test(input.archiveSha256)) throw new Error(`"${input.archiveSha256}" is not a SHA-256 in lowercase hex`);
  return {
    version: input.release.version,
    tag: input.release.tag,
    commit: input.commit,
    createdAt: normalizeCreatedAt(input.createdAt),
    files: [...input.files].sort(compareByPath),
    archiveSha256: input.archiveSha256,
  };
}

/** Fixed key order, two spaces, a trailing newline: the bytes the site hashes and reads. */
export function serializeManifest(manifest: ReleaseManifest): string {
  const ordered = {
    version: manifest.version,
    tag: manifest.tag,
    commit: manifest.commit,
    createdAt: manifest.createdAt,
    files: manifest.files.map((file) => ({ path: file.path, sha256: file.sha256, bytes: file.bytes })),
    archiveSha256: manifest.archiveSha256,
  };
  return `${JSON.stringify(ordered, null, 2)}\n`;
}
