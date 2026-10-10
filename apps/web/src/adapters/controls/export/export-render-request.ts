// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What a Render asks ExportJobs for: one file to render under its key with its
// frozen plan, the HD job 4K falls back to before the first probe, or nothing (the file is
// kept) or a refusal. Pure: the plans, keys and title are handed in.
import type { Program } from "@untzel/core";
import type { ExportPlan, ExportQuality, PlanResult } from "@untzel/export";
import type { ExportFormat } from "@untzel/presentation/view-model";
import type { ExportTitleText } from "../export-sheet/export-title";

/** One file to render: its key among the kept files, the frozen plan and what it plays. */
export interface RenderJob {
  readonly kind: "render";
  readonly key: string;
  readonly plan: ExportPlan;
  readonly program: Program;
  readonly title: ExportTitleText;
}
/** 4K chosen before the first probe: the HD job to render if the probe refuses 4K; else null. */
export type RenderFallback = RenderJob | null;
/** What the caller wants once the module is there: a job, nothing (already kept), or a failure. */
export type JobRequest =
  | (RenderJob & { readonly fallback: RenderFallback })
  | { readonly kind: "kept" }
  | { readonly kind: "refused"; readonly message: string };

export type RenderRequest = Extract<JobRequest, { kind: "render" }>;

/** What a Render reads at the tap; the plans come from the position at that moment. */
export interface RenderAsk {
  readonly program: Program | null;
  readonly format: ExportFormat;
  readonly quality: ExportQuality;
  /** A device probe is kept: 4K needs no HD fallback. */
  readonly isProbed: () => boolean;
  readonly plan: (quality: ExportQuality) => PlanResult;
  readonly keyFor: (sourceHash: number, quality: ExportQuality) => string;
  readonly title: () => ExportTitleText;
  readonly isKept: (key: string) => boolean;
  readonly refusal: (planned: Extract<PlanResult, { ok: false }>) => string;
  /** Said when there is no program to render. */
  readonly emptyRange: string;
}

export function renderRequest(ask: RenderAsk): JobRequest {
  const planned = ask.plan(ask.quality);
  if (!planned.ok) return { kind: "refused", message: ask.refusal(planned) };
  const { program } = ask;
  if (program === null) return { kind: "refused", message: ask.emptyRange };
  const key = ask.keyFor(program.sourceHash, ask.quality);
  const title = ask.title();
  if (ask.isKept(key)) return { kind: "kept" };
  return { kind: "render", key, plan: planned.plan, program, title, fallback: hdFallback(ask, program, title) };
}

/** 4K before the first probe: the HD job the probe may fall back to (export-probe.ts, withinProbe). */
function hdFallback(ask: RenderAsk, program: Program, title: ExportTitleText): RenderFallback {
  if (ask.quality === "hd" || ask.format === "audio" || ask.isProbed()) return null;
  const planned = ask.plan("hd");
  return planned.ok ? { kind: "render", key: ask.keyFor(program.sourceHash, "hd"), plan: planned.plan, program, title } : null;
}
