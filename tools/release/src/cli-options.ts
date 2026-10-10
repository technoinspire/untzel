// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// `--name value` options of the release command line. Every listed option is required,
// once; anything else is a usage error (exit code 2), not a validation error.

export class UsageError extends Error {}

export function parseOptions<Name extends string>(args: readonly string[], names: readonly Name[]): Record<Name, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index] ?? "";
    const name = flag.startsWith("--") ? flag.slice(2) : "";
    const value = args[index + 1];
    if (!(names as readonly string[]).includes(name)) throw new UsageError(`unknown argument ${flag}`);
    if (values.has(name)) throw new UsageError(`--${name} given twice`);
    if (value === undefined || value.startsWith("--")) throw new UsageError(`--${name} needs a value`);
    values.set(name, value);
  }
  const missing = names.filter((name) => !values.has(name));
  if (missing.length > 0) throw new UsageError(`missing ${missing.map((name) => `--${name}`).join(", ")}`);
  return Object.fromEntries(values) as Record<Name, string>;
}
