// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { IssueCollector, isRecord, type Fields } from "./manifest-fields";
import {
  SCENE_DRIVES,
  isSceneFamily,
  isShapeOf,
  type SceneDensity,
  type SceneDrive,
  type SceneSpec,
  type SceneTint,
} from "./scene-catalog";
// Reads the `scene` field of a manifest:
// which family of light the instrument draws, in which shape, and which
// part of its sound drives it. An invalid field is a build error, never a runtime one.

const SCENE_FIELDS = new Set(["family", "variant", "drive"]);
const VARIANT_FIELDS = new Set(["shape", "density", "tint"]);


/** What the scene reads from the rest of the manifest to check its drive. */
export interface SceneContext {
  readonly kind: string;
  readonly parameters: readonly { readonly name: string }[];
  readonly tone: readonly unknown[];
}

/** Null when absent (the category's default applies); an invalid field is a build error. */
export function readScene(value: unknown, context: SceneContext, issues: IssueCollector): SceneSpec | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) {
    issues.add("scene", "must be an object");
    return null;
  }
  rejectUnknown(value, SCENE_FIELDS, "scene", issues);
  const family = value["family"];
  if (!isSceneFamily(family)) {
    issues.add("scene.family", "must be a scene family");
    return null;
  }
  const variant = isRecord(value["variant"]) ? value["variant"] : {};
  rejectUnknown(variant, VARIANT_FIELDS, "scene.variant", issues);
  const shape = variant["shape"];
  if (!isShapeOf(family, shape)) issues.add("scene.variant.shape", `must be a shape of ${family}`);
  const density = readDensity(variant["density"], issues);
  const tint = readTint(variant["tint"], issues);
  const drive = readDrive(value["drive"], context, issues);
  if (!isShapeOf(family, shape) || drive === null) return null;
  return { family, variant: { shape, density, tint }, drive };
}

function rejectUnknown(fields: Fields, known: ReadonlySet<string>, path: string, issues: IssueCollector): void {
  for (const name of Object.keys(fields)) if (!known.has(name)) issues.add(`${path}.${name}`, "unknown field");
}

function readDensity(value: unknown, issues: IssueCollector): SceneDensity {
  if (value === undefined) return 2;
  if (value === 1 || value === 2 || value === 3) return value;
  issues.add("scene.variant.density", "must be 1, 2 or 3");
  return 2;
}

function readTint(value: unknown, issues: IssueCollector): SceneTint {
  if (value === undefined) return "track";
  if (value === "track" || value === "track-white-core") return value;
  issues.add("scene.variant.tint", "must be track or track-white-core");
  return "track";
}

function readDrive(value: unknown, context: SceneContext, issues: IssueCollector): SceneDrive | null {
  if (typeof value !== "string" || !(SCENE_DRIVES as readonly string[]).includes(value)) {
    issues.add("scene.drive", "must be a scene drive");
    return null;
  }
  const drive = value as SceneDrive;
  const hasTune = context.parameters.some((parameter) => parameter.name === "tune" || parameter.name === "pitch");
  if (drive === "pitch" && context.kind === "drum" && !hasTune) {
    issues.add("scene.drive", "pitch needs notes or a tune parameter");
    return null;
  }
  if (drive === "cutoff" && context.tone[0] === undefined) {
    issues.add("scene.drive", "cutoff needs a tone mapping");
    return null;
  }
  return drive;
}
