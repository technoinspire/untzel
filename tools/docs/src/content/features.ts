// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Evaluates the probes of apps/docs/src/features.ts against this build.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as core from "@untzel/core";
// Static, not import() on first use: the launcher's Vite module runner is closed by the
// time a probe asks, and a dynamic import through a closed runner throws.
import { cruise } from "dependency-cruiser";
import { FEATURES, type FeatureId, type Probe } from "../../../../apps/docs/src/features";
import type { DocsSources } from "./sources";

export type FeatureStates = ReadonlyMap<FeatureId, boolean>;

/** Named imports from a package by the modules apps/web/src/main.ts reaches. */
export type AppImports = (packageName: string) => Promise<ReadonlySet<string>>;

export interface ProbeContext {
  readonly sources: Pick<DocsSources, "built" | "rawManifests" | "templates">;
  readonly coreExports: ReadonlySet<string>;
  readonly appImports: AppImports;
}

function hasChoice(manifest: unknown, parameter: string, choice: string): boolean {
  if (typeof manifest !== "object" || manifest === null || !("parameters" in manifest) || !Array.isArray(manifest.parameters)) return false;
  return manifest.parameters.some((entry: unknown) => {
    if (typeof entry !== "object" || entry === null || !("name" in entry) || entry.name !== parameter || !("choices" in entry)) return false;
    return Array.isArray(entry.choices) && entry.choices.includes(choice);
  });
}

function isNamed(manifest: unknown, name: string): boolean {
  return typeof manifest === "object" && manifest !== null && "name" in manifest && manifest.name === name;
}
async function evaluate(probe: Probe, context: ProbeContext): Promise<boolean> {
  const { built, rawManifests, templates } = context.sources;
  switch (probe.kind) {
    case "manifest-kind":
      return built.instruments.some((manifest) => manifest.kind === probe.value);
    case "instrument":
      return built.registry.has(probe.name);
    case "raw-manifest-field":
      return rawManifests.some((manifest) => typeof manifest === "object" && manifest !== null && probe.field in manifest);
    case "raw-manifest-choice":
      return rawManifests.some((manifest) => hasChoice(manifest, probe.parameter, probe.choice));
    case "instrument-choice":
      return rawManifests.some((manifest) => isNamed(manifest, probe.instrument) && hasChoice(manifest, probe.parameter, probe.choice));
    case "template":
      return templates.some((template) => template.id === probe.id);
    case "core-export":
      return context.coreExports.has(probe.name);
    case "app-import":
      return (await context.appImports(probe.packageName)).has(probe.entry);
  }
}

export async function evaluateFeatures(context: ProbeContext): Promise<FeatureStates> {
  const states = new Map<FeatureId, boolean>();
  for (const feature of FEATURES) states.set(feature.id, await evaluate(feature.probe, context));
  return states;
}

/** `import { a, b as c, type d } from "pkg"` (or "pkg/sub") -> a, b (type-only names do not count). */
export function namedImports(source: string, packageName: string): ReadonlySet<string> {
  const names = new Set<string>();
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const pattern = new RegExp(`import\\s+(type\\s+)?\\{([^}]*)\\}\\s*from\\s*["']${escaped}(?:/[^"']*)?["']`, "g");
  for (const match of source.matchAll(pattern)) {
    if (match[1] !== undefined) continue;
    for (const part of (match[2] ?? "").split(",")) {
      const name = part.trim();
      if (name === "" || name.startsWith("type ")) continue;
      names.add(name.split(/\s+as\s+/)[0] ?? name);
    }
  }
  return names;
}

/** `import("pkg")`: the app loads the package on demand (the export module). */
export function isDynamicallyImported(source: string, packageName: string): boolean {
  return source.includes(`import("${packageName}")`) || source.includes(`import('${packageName}')`);
}

function mentions(source: string, packageName: string): boolean {
  return source.includes(`"${packageName}"`) || source.includes(`'${packageName}'`);
}

/** `api.chooseTiers(`, `new api.ExportClient(`: the names a module reads off a loaded module. */
export function memberNames(source: string): ReadonlySet<string> {
  return new Set([...source.matchAll(/\.\s*([A-Za-z_$][\w$]*)/g)].map((match) => match[1] ?? ""));
}

interface CruisedModule {
  readonly source: string;
  readonly dependencies: readonly { readonly module: string }[];
}

/**
 * The real import graph of the app, by dependency-cruiser from apps/web/src/main.ts. Runs
 * only for a package apps/web declares, so on a build without it nothing is cruised.
 */
export function appImportsOf(repo: string, webDependencies: ReadonlySet<string>): AppImports {
  return async (packageName) => {
    if (!webDependencies.has(packageName)) return new Set();
    const result = await cruise(["apps/web/src/main.ts"], {
      // No trailing separator: with combinedDependencies, dependency-cruiser throws on a
      // baseDir that ends in one, and the launcher's repo path does.
      baseDir: resolve(repo),
      doNotFollow: { path: "node_modules" },
      exclude: { path: "(^|/)(node_modules|dist|\\.cache|target)/" },
      parser: "swc",
      combinedDependencies: true,
      enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "default"], extensions: [".ts", ".js"] },
    });
    const output = result.output as unknown as { readonly modules: readonly CruisedModule[] };
    const texts = output.modules.filter((module) => /\.ts$/.test(module.source) && !module.source.includes("node_modules") && existsSync(join(repo, module.source))).map((module) => ({ module, text: readFileSync(join(repo, module.source), "utf8") }));
    const isLoadedLazily = texts.some(({ text }) => isDynamicallyImported(text, packageName));
    const names = new Set<string>();
    for (const { module, text } of texts) {
      if (module.dependencies.some((dependency) => dependency.module === packageName || dependency.module.startsWith(`${packageName}/`))) {
        for (const name of namedImports(text, packageName)) names.add(name);
      }
      if (isLoadedLazily && mentions(text, packageName)) for (const name of memberNames(text)) names.add(name);
    }
    return names;
  };
}

export function coreExportNames(): ReadonlySet<string> {
  return new Set(Object.keys(core));
}
