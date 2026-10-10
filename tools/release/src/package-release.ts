// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Use case of `release package`: layout, archive, manifest and dispatch body, all built and
// validated in memory first, then written to the output directory.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dispatchPayload, serializeDispatchPayload } from "./dispatch-payload";
import { releaseAssetNames } from "./release-assets";
import { releaseLayout, type LayoutSources } from "./release-layout";
import { buildManifest, manifestFile, normalizeCreatedAt, serializeManifest, sha256Hex } from "./release-manifest";
import { parseReleaseTag } from "./release-version";
import { createTarGz, type ArchiveEntry } from "./tar-archive";

export interface PackageRequest extends LayoutSources {
  readonly tag: string;
  readonly commit: string;
  /** ISO 8601 commit time with offset; also the modification time of every entry. */
  readonly createdAt: string;
  /** owner/name of this repository, for the download URLs. */
  readonly repository: string;
  readonly out: string;
}

export interface PackageResult {
  readonly archivePath: string;
  readonly manifestPath: string;
  readonly dispatchPath: string;
  readonly archiveSha256: string;
  readonly files: number;
}

export function packageRelease(request: PackageRequest): PackageResult {
  const release = parseReleaseTag(request.tag);
  const createdAt = normalizeCreatedAt(request.createdAt);
  const entries: ArchiveEntry[] = releaseLayout(request).map((entry) => ({ path: entry.path, content: readFileSync(entry.absolutePath) }));
  const archive = createTarGz(entries, Date.parse(createdAt) / 1000);
  const archiveSha256 = sha256Hex(archive);
  const files = entries.map((entry) => manifestFile(entry.path, entry.content));
  const manifest = buildManifest({ release, commit: request.commit, createdAt, files, archiveSha256 });
  const dispatch = dispatchPayload(request.repository, release, archiveSha256);
  const names = releaseAssetNames(release.version);
  const result = {
    archivePath: join(request.out, names.archive),
    manifestPath: join(request.out, names.manifest),
    dispatchPath: join(request.out, names.dispatch),
    archiveSha256,
    files: files.length,
  };
  mkdirSync(request.out, { recursive: true });
  writeFileSync(result.archivePath, archive);
  writeFileSync(result.manifestPath, serializeManifest(manifest));
  writeFileSync(result.dispatchPath, serializeDispatchPayload(dispatch));
  return result;
}
