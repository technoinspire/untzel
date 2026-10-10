// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Which template a command line names and with which pacing: a demo name (demos/<name>.demo.json),
// a template id ("melodic-techno/midnight-bloom"), a template's file name ("red-earth"), or a
// path. A template without a demo file takes the first demo file that builds it, by name.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { TEMPLATE_DIR, readTemplateTree, templateFiles } from "@untzel/sim/template-tree";
import { parseDemoFile, type DemoFile } from "./demo-file";
export const DEMOS = "demos";
const DEMO_SUFFIX = ".demo.json";

/** A command line or a demo file that cannot be used: exit code 2. */
export class InputError extends Error {}

export interface ResolvedDemo {
  readonly templateName: string;
  readonly templatePath: string;
  readonly demoPath: string | null;
  readonly demo: DemoFile | null;
}

function readDemo(path: string): DemoFile {
  const result = parseDemoFile(JSON.parse(readFileSync(path, "utf8")) as unknown);
  if (!result.ok) throw new InputError(`${path}: ${result.issues.join("; ")}`);
  return result.demo;
}

/** The first demo file (by name) that builds `template`, if any. */
function demoForTemplate(repo: string, template: string): string | null {
  const folder = join(repo, DEMOS);
  if (!existsSync(folder)) return null;
  const files = readdirSync(folder).filter((file) => file.endsWith(DEMO_SUFFIX)).sort();
  const match = files.find((file) => templateIdOf(repo, templatePathOf(repo, readDemo(join(folder, file)).template)) === template);
  return match === undefined ? null : join(folder, match);
}

/** A template by id ("melodic-techno/midnight-bloom") or by its file name ("midnight-bloom"). */
function templatePathOf(repo: string, name: string): string {
  const files = templateFiles(readTemplateTree(repo));
  const found = files.find((file) => file.id === name) ?? files.find((file) => file.id.endsWith(`/${name}`));
  return join(repo, TEMPLATE_DIR, `${found?.id ?? name}.untzel`);
}
function templateIdOf(repo: string, path: string): string {
  const folder = join(repo, TEMPLATE_DIR);
  return path.startsWith(`${folder}/`) ? path.slice(folder.length + 1, -".untzel".length) : basename(path, ".untzel");
}
export function resolveDemo(repo: string, argument: string): ResolvedDemo {
  const named = join(repo, DEMOS, `${argument}${DEMO_SUFFIX}`);
  const demoPath = argument.endsWith(DEMO_SUFFIX) ? resolve(argument) : existsSync(named) ? named : null;
  if (demoPath !== null) {
    const demo = readDemo(demoPath);
    const templatePath = templatePathOf(repo, demo.template);
    return { templateName: templateIdOf(repo, templatePath), templatePath, demoPath, demo };
  }
  const templatePath = argument.endsWith(".untzel") ? resolve(argument) : templatePathOf(repo, argument);
  const templateName = templateIdOf(repo, templatePath);
  const found = demoForTemplate(repo, templateName);
  return { templateName, templatePath, demoPath: found, demo: found === null ? null : readDemo(found) };
}
