// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Body of the repository_dispatch a release rehearsal sends to the site. A
// rehearsal has no tag and no GitHub release: the site downloads the run's artifact, so the
// notice names the run and takes commit, tag, version and digest from the packaged manifest.
import { checkRepository } from "./dispatch-payload";
import { parseReleaseTag } from "./release-version";

export const REHEARSAL_EVENT = "untzel-release-rehearsal";
const RUN_ID = /^[1-9][0-9]{0,19}$/;
const BRANCH_REF = /^refs\/heads\/[A-Za-z0-9._/-]+$/;
const COMMIT = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

export interface RehearsalRequest {
  /** Text of untzel-<v>.manifest.json as `release package` wrote it. */
  readonly manifest: string;
  readonly runId: string;
  /** The branch the rehearsal ran on, as $GITHUB_REF. */
  readonly ref: string;
  /** owner/name of this repository, whose run holds the artifact. */
  readonly repository: string;
}

export interface RehearsalNotice {
  readonly repository: string;
  readonly runId: string;
  readonly ref: string;
  readonly commit: string;
  readonly tag: string;
  readonly version: string;
  readonly archiveSha256: string;
}

export interface RehearsalPayload {
  readonly event_type: typeof REHEARSAL_EVENT;
  readonly client_payload: RehearsalNotice;
}

interface ManifestFields {
  readonly commit: string;
  readonly tag: string;
  readonly version: string;
  readonly archiveSha256: string;
}

function checkRunId(runId: string): string {
  if (!RUN_ID.test(runId)) throw new Error(`"${runId}" is not a workflow run id`);
  return runId;
}

function checkBranchRef(ref: string): string {
  if (!BRANCH_REF.test(ref) || ref.includes("..")) throw new Error(`"${ref}" is not a branch ref (refs/heads/<name>)`);
  return ref;
}

function field(manifest: Record<string, unknown>, name: string, pattern?: RegExp): string {
  const value = manifest[name];
  if (typeof value !== "string" || (pattern !== undefined && !pattern.test(value))) throw new Error(`the manifest has no valid ${name}`);
  return value;
}

function manifestFields(text: string): ManifestFields {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("the manifest is not JSON");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("the manifest is not a JSON object");
  const manifest = parsed as Record<string, unknown>;
  const release = parseReleaseTag(field(manifest, "tag"));
  if (field(manifest, "version") !== release.version) throw new Error(`the manifest version does not match its tag ${release.tag}`);
  return { ...release, commit: field(manifest, "commit", COMMIT), archiveSha256: field(manifest, "archiveSha256", SHA256) };
}

export function rehearsalPayload(request: RehearsalRequest): RehearsalPayload {
  const repository = checkRepository(request.repository);
  const runId = checkRunId(request.runId);
  const ref = checkBranchRef(request.ref);
  const { commit, tag, version, archiveSha256 } = manifestFields(request.manifest);
  return { event_type: REHEARSAL_EVENT, client_payload: { repository, runId, ref, commit, tag, version, archiveSha256 } };
}

export function serializeRehearsalPayload(payload: RehearsalPayload): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
