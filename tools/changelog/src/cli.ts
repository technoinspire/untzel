// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Command line of the changelog tool, used by ci.yml (check) and release.yml
// (build). Exit 0 ok, 1 invalid entries or a missing entry, 2 usage.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { EntryError, parseChangeEntry } from "./change-entry";
import { compileChangelog, serializeChangelog, type EntryOrigin, type SourcedEntry } from "./compile-changelog";
import { ENTRIES_DIRECTORY, missingEntry } from "./pull-request-check";

export interface CliEnvironment {
  readonly repo: string;
}

const USAGE = `usage:
  changelog check [--base <git ref>] [--skip]
  changelog build --repository <owner/name> --out <file>`;

class UsageError extends Error {}

function option(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) throw new UsageError(`--${name} needs a value`);
  return value;
}

function git(repo: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" }).trim();
}

/** Every entry file, parsed; all problems are reported together. */
function readEntries(repo: string): { path: string; entry: ReturnType<typeof parseChangeEntry> }[] {
  const directory = join(repo, ENTRIES_DIRECTORY);
  const names = readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
  const problems: string[] = [];
  const entries = names.flatMap((name) => {
    const path = `${ENTRIES_DIRECTORY}${name}`;
    try {
      return [{ path, entry: parseChangeEntry(JSON.parse(readFileSync(join(directory, name), "utf8"))) }];
    } catch (error) {
      problems.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  });
  if (problems.length > 0) throw new EntryError(problems.join("\n"));
  return entries;
}

function originOf(repo: string, path: string): EntryOrigin | null {
  const line = git(repo, ["log", "--diff-filter=A", "--format=%cs%x09%s", "--", path]).split("\n").pop() ?? "";
  if (line === "") return null;
  const [date = "", ...subject] = line.split("\t");
  return { date, subject: subject.join("\t") };
}

function check(args: readonly string[], { repo }: CliEnvironment): void {
  const entries = readEntries(repo);
  const base = option(args, "base");
  if (base !== undefined) {
    const range = `${base}...HEAD`;
    const lines = (text: string) => text.split("\n").filter(Boolean);
    const reason = missingEntry({
      changed: lines(git(repo, ["diff", "--name-only", range])),
      added: lines(git(repo, ["diff", "--diff-filter=A", "--name-only", range])),
      skip: args.includes("--skip"),
    });
    if (reason !== null) throw new EntryError(reason);
  }
  console.log(`changelog: ${entries.length} entries are valid`);
}

function build(args: readonly string[], { repo }: CliEnvironment): void {
  const repository = option(args, "repository");
  const out = option(args, "out");
  if (repository === undefined || out === undefined) throw new UsageError("build needs --repository and --out");
  const sourced: SourcedEntry[] = readEntries(repo).map(({ path, entry }) => ({ path, entry, origin: originOf(repo, path) }));
  const today = new Date().toISOString().slice(0, 10);
  const changelog = compileChangelog(sourced, repository, today);
  const target = resolve(repo, out);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, serializeChangelog(changelog));
  console.log(`changelog=${target}\nentries=${changelog.entries.length}`);
}

export async function main(args: readonly string[], environment: CliEnvironment): Promise<number> {
  const [command, ...rest] = args;
  try {
    if (command === "check") check(rest, environment);
    else if (command === "build") build(rest, environment);
    else throw new UsageError(command === undefined ? "missing command" : `unknown command ${command}`);
    return 0;
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`changelog: ${error.message}\n${USAGE}`);
      return 2;
    }
    console.error(`changelog: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
