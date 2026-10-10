// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The finished files the open export sheet keeps: the last one of each format, at
// most 256 MB together, the oldest out first. The newest always stays, even alone above
// the ceiling (a measured 5:50 video is 267 MB): it is what the person just asked for.
// Each kept file has an object URL for the sheet's preview player, revoked when the file
// leaves.
import type { ExportFormat } from "@untzel/presentation/view-model";
import type { ExportPlan, RateControlReport } from "@untzel/export";

export const MAX_KEPT_BYTES = 256 * 1024 * 1024;

/** What a finished render reports, for the test hooks and the measurements. */
export interface ExportDetails {
  readonly codecs: string;
  readonly renderMs: number;
  /** Of renderMs, the codec probe's retries on a busy machine: outside the render budget. */
  readonly codecRetryMs: number;
  readonly audioSamples: number;
  readonly counters: { readonly lateDrops: number; readonly queueDrops: number; readonly nanResets: number };
  readonly rateControl: RateControlReport | null;
}

export interface KeptFile {
  /** The request key (export-request.ts), never the live position. */
  readonly key: string;
  readonly format: ExportFormat;
  /** The plan frozen when the job started: its origin is what the sheet shows. */
  readonly plan: ExportPlan;
  readonly file: File;
  readonly details: ExportDetails;
  readonly label: string;
  readonly canShare: boolean;
}

export interface KeptExport extends KeptFile {
  /** The file's object URL, alive while it is kept. */
  readonly url: string;
}

export interface ObjectUrls {
  create(file: File): string;
  revoke(url: string): void;
}

const browserUrls: ObjectUrls = {
  create: (file) => URL.createObjectURL(file),
  revoke: (url) => URL.revokeObjectURL(url),
};

export class KeptExports {
  readonly #maxBytes: number;
  readonly #urls: ObjectUrls;
  #entries: readonly KeptExport[] = [];

  constructor(maxBytes = MAX_KEPT_BYTES, urls: ObjectUrls = browserUrls) {
    this.#maxBytes = maxBytes;
    this.#urls = urls;
  }

  keep(kept: KeptFile): void {
    const entry: KeptExport = { ...kept, url: this.#urls.create(kept.file) };
    let entries = [...this.#entries.filter((other) => other.format !== kept.format), entry];
    while (entries.length > 1 && totalBytes(entries) > this.#maxBytes) entries = entries.slice(1);
    for (const old of this.#entries) if (!entries.includes(old)) this.#urls.revoke(old.url);
    this.#entries = entries;
  }

  find(key: string): KeptExport | null {
    return this.#entries.find((entry) => entry.key === key) ?? null;
  }

  has(key: string): boolean {
    return this.find(key) !== null;
  }

  clear(): void {
    for (const entry of this.#entries) this.#urls.revoke(entry.url);
    this.#entries = [];
  }
}

function totalBytes(entries: readonly KeptExport[]): number {
  return entries.reduce((sum, entry) => sum + entry.file.size, 0);
}
