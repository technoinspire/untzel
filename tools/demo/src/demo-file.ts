// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { DemoActionKind } from "./actions";
import { MAX_FEATURED_LAYERS } from "./script/featured-layers";

// demos/<name>.demo.json: which template a demo builds, which of its tracks are built by
// hand, and how its rhythm and emphasis differ from the defaults. It never lists actions;
// those come from the template.

export interface LayerOverrides {
  /** Bars the music plays after this layer enters, before the next one starts. */
  readonly listenBars?: number;
}

export interface PacingOverrides {
  /** Bars of the empty stage before the first gesture. */
  readonly introBars?: number;
  readonly listenBars?: number;
  /** Bars of the finished song after the last gesture. */
  readonly outroBars?: number;
  /** Code typing speed, at reading pace. */
  readonly typingCharsPerSecond?: number;
  /** Speed of the band's lines and the arrangement, typed in bursts. */
  readonly burstCharsPerSecond?: number;
  /** Seconds a gesture takes, per action kind. */
  readonly gestureSeconds?: Readonly<Partial<Record<DemoActionKind, number>>>;
  /** By layer name: a track name, "setup" or "arrangement". */
  readonly layers?: Readonly<Record<string, LayerOverrides>>;
}

export interface DemoFile {
  readonly template: string;
  readonly title: string | null;
  /** The tracks built by hand, by name; null picks the first track of each family. */
  readonly featured: readonly string[] | null;
  readonly pacing: PacingOverrides;
}

export type DemoFileResult =
  | { readonly ok: true; readonly demo: DemoFile }
  | { readonly ok: false; readonly issues: readonly string[] };

const PACING_KEYS = new Set(["introBars", "listenBars", "outroBars", "typingCharsPerSecond", "burstCharsPerSecond", "gestureSeconds", "layers"]);
/** Every action kind; the Record type makes the compiler flag a missing one. */
const ACTION_KINDS: Readonly<Record<DemoActionKind, true>> = {
  addTrack: true,
  renameTrack: true,
  setStepCount: true,
  setTrackBars: true,
  toggleStep: true,
  setStepNote: true,
  setParameter: true,
  setMute: true,
  setLoopBars: true,
  addSectionMember: true,
  typeCode: true,
  togglePlay: true,
  setMode: true,
  drop: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Collects one issue per bad field; never throws. */
class Checker {
  readonly issues: string[] = [];

  number(path: string, value: unknown, min: number, integer: boolean): void {
    const isValid = typeof value === "number" && Number.isFinite(value) && value >= min && (!integer || Number.isInteger(value));
    if (!isValid) this.issues.push(`${path} must be ${integer ? "a whole number" : "a number"} ≥ ${min}`);
  }

  record(path: string, value: unknown, check: (key: string, child: unknown) => void): void {
    if (!isRecord(value)) {
      this.issues.push(`${path} must be an object`);
      return;
    }
    for (const [key, child] of Object.entries(value)) check(key, child);
  }
}

function checkPacing(checker: Checker, pacing: unknown): void {
  checker.record("pacing", pacing, (key, value) => {
    const path = `pacing.${key}`;
    if (!PACING_KEYS.has(key)) checker.issues.push(`${path} is not a pacing field`);
    else if (key === "gestureSeconds") {
      checker.record(path, value, (kind, seconds) => {
        if (Object.hasOwn(ACTION_KINDS, kind)) checker.number(`${path}.${kind}`, seconds, 0, false);
        else checker.issues.push(`${path}.${kind} is not a demo action`);
      });
    } else if (key === "layers") {
      checker.record(path, value, (layer, overrides) => {
        checker.record(`${path}.${layer}`, overrides, (field, bars) => {
          if (field === "listenBars") checker.number(`${path}.${layer}.listenBars`, bars, 0, true);
          else checker.issues.push(`${path}.${layer}.${field} is not a layer field`);
        });
      });
    } else if (key === "typingCharsPerSecond" || key === "burstCharsPerSecond") checker.number(path, value, 1, false);
    else checker.number(path, value, 0, true);
  });
}

/** One to six distinct track names; the template is checked when the demo is built. */
function checkFeatured(checker: Checker, featured: unknown): void {
  if (featured === null) return;
  const isNames = Array.isArray(featured) && featured.every((name) => typeof name === "string" && name !== "");
  if (!isNames || featured.length === 0 || featured.length > MAX_FEATURED_LAYERS || new Set(featured).size !== featured.length) {
    checker.issues.push(`featured must list 1 to ${MAX_FEATURED_LAYERS} distinct track names`);
  }
}

/** Reads a parsed demo.json. Unknown fields are issues, so a typo never passes silently. */
export function parseDemoFile(json: unknown): DemoFileResult {
  const checker = new Checker();
  if (!isRecord(json)) return { ok: false, issues: ["a demo file must be a JSON object"] };
  const { template, title = null, featured = null, pacing = {}, ...rest } = json;
  if (typeof template !== "string" || template === "") checker.issues.push("template must name a template");
  if (title !== null && typeof title !== "string") checker.issues.push("title must be text");
  checkFeatured(checker, featured);
  for (const key of Object.keys(rest)) if (key !== "$comment") checker.issues.push(`${key} is not a demo field`);
  checkPacing(checker, pacing);
  if (checker.issues.length > 0) return { ok: false, issues: checker.issues };
  return { ok: true, demo: { template: template as string, title: title as string | null, featured: featured as string[] | null, pacing: pacing as PacingOverrides } };
}
