// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Body of the repository_dispatch the release sends to the site. The site checks
// every field against its own contract; the URLs are the public download URLs of the assets.
import { releaseAssetNames } from "./release-assets";
import type { ReleaseVersion } from "./release-version";

export const DISPATCH_EVENT = "untzel-release";
const REPOSITORY = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/;

export interface ReleaseNotice {
  readonly tag: string;
  readonly version: string;
  readonly assetUrl: string;
  readonly archiveSha256: string;
  readonly manifestUrl: string;
}

export interface DispatchPayload {
  readonly event_type: typeof DISPATCH_EVENT;
  readonly client_payload: ReleaseNotice;
}

export function checkRepository(repository: string): string {
  const name = repository.split("/")[1];
  if (!REPOSITORY.test(repository) || name === "." || name === "..") {
    throw new Error(`"${repository}" is not a GitHub repository (owner/name)`);
  }
  return repository;
}

export function releaseDownloadUrl(repository: string, tag: string, file: string): string {
  return `https://github.com/${checkRepository(repository)}/releases/download/${tag}/${file}`;
}

export function dispatchPayload(repository: string, release: ReleaseVersion, archiveSha256: string): DispatchPayload {
  const names = releaseAssetNames(release.version);
  return {
    event_type: DISPATCH_EVENT,
    client_payload: {
      tag: release.tag,
      version: release.version,
      assetUrl: releaseDownloadUrl(repository, release.tag, names.archive),
      archiveSha256,
      manifestUrl: releaseDownloadUrl(repository, release.tag, names.manifest),
    },
  };
}

export function serializeDispatchPayload(payload: DispatchPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
