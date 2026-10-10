// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Command line of the release tool, used by .github/workflows/release.yml. Standard output
// is key=value lines, the format of $GITHUB_OUTPUT. Exit 0 ok, 1 invalid input, 2 usage.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseOptions, UsageError } from "./cli-options";
import { packageRelease } from "./package-release";
import { rehearsalPayload, serializeRehearsalPayload } from "./rehearsal-notice";
import { parseSourcedReleaseTag, RELEASE_SOURCES, type ReleaseSource } from "./release-version";

export interface CliEnvironment {
  /** Repository root: relative paths and the license notices are resolved from it. */
  readonly repo: string;
}

const USAGE = `usage:
  release version --tag vX.Y.Z --source tag|rehearsal
  release package --tag vX.Y.Z --commit <40 hex> --created-at <ISO 8601> --repository <owner/name>
                  --app <app build> --docs <docs build> --out <directory>
  release rehearsal-notice --manifest <manifest file> --run-id <id> --ref refs/heads/<branch>
                           --repository <owner/name> --out <file>`;

const PACKAGE_OPTIONS = ["tag", "commit", "created-at", "repository", "app", "docs", "out"] as const;
const REHEARSAL_OPTIONS = ["manifest", "run-id", "ref", "repository", "out"] as const;

function releaseSourceOf(value: string): ReleaseSource {
  const source = RELEASE_SOURCES.find((candidate) => candidate === value);
  if (source === undefined) throw new UsageError(`--source must be ${RELEASE_SOURCES.join(" or ")}, not "${value}"`);
  return source;
}
function printVersion(args: readonly string[]): void {
  const options = parseOptions(args, ["tag", "source"]);
  const { tag, version } = parseSourcedReleaseTag(options.tag, releaseSourceOf(options.source));
  console.log(`tag=${tag}\nversion=${version}`);
}

function printPackage(args: readonly string[], environment: CliEnvironment): void {
  const options = parseOptions(args, PACKAGE_OPTIONS);
  const result = packageRelease({
    tag: options.tag,
    commit: options.commit,
    createdAt: options["created-at"],
    repository: options.repository,
    app: resolve(environment.repo, options.app),
    docs: resolve(environment.repo, options.docs),
    repo: environment.repo,
    out: resolve(environment.repo, options.out),
  });
  console.log(`archive=${result.archivePath}\nmanifest=${result.manifestPath}\ndispatch=${result.dispatchPath}`);
  console.log(`archiveSha256=${result.archiveSha256}\nfiles=${result.files}`);
}

function printRehearsalNotice(args: readonly string[], environment: CliEnvironment): void {
  const options = parseOptions(args, REHEARSAL_OPTIONS);
  const payload = rehearsalPayload({
    manifest: readFileSync(resolve(environment.repo, options.manifest), "utf8"),
    runId: options["run-id"],
    ref: options.ref,
    repository: options.repository,
  });
  const out = resolve(environment.repo, options.out);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, serializeRehearsalPayload(payload));
  console.log(`rehearsal=${out}`);
}

export async function main(args: readonly string[], environment: CliEnvironment): Promise<number> {
  const [command, ...rest] = args;
  try {
    if (command === "version") printVersion(rest);
    else if (command === "package") printPackage(rest, environment);
    else if (command === "rehearsal-notice") printRehearsalNotice(rest, environment);
    else throw new UsageError(command === undefined ? "missing command" : `unknown command ${command}`);
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`release: ${error.message}\n${USAGE}`);
      return 2;
    }
    console.error(`release: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
