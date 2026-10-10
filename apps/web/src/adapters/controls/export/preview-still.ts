// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The Export sheet preview's still: one frame of the scene being heard,
// drawn the way the file draws it, at 0.4 × the format's HD frame. A later request or a clear
// drops an earlier answer, and every object URL it made is revoked when it is replaced or
// cleared.
import type { ExportFormat } from "@untzel/presentation/view-model";

/** The preview's still, 0.4 × the HD frame of each format (1080 × 1920 and 1920 × 1080). */
const STILL_SIZES = { story: { width: 432, height: 768 }, video: { width: 768, height: 432 } } as const;

export type SceneStill = (size: { readonly width: number; readonly height: number }) => Promise<Blob | null>;

export class PreviewStill {
  readonly #sceneStill: SceneStill;
  readonly #onChange: () => void;
  #still: { readonly format: ExportFormat; readonly url: string } | null = null;
  #request = 0;

  constructor(sceneStill: SceneStill, onChange: () => void) {
    this.#sceneStill = sceneStill;
    this.#onChange = onChange;
  }

  /** Asks for the format's still; audio has none. */
  request(format: ExportFormat): void {
    const request = (this.#request += 1);
    if (format === "audio") return;
    void this.#sceneStill(STILL_SIZES[format]).then(
      (blob) => {
        if (blob === null || request !== this.#request) return;
        this.#drop();
        this.#still = { format, url: URL.createObjectURL(blob) };
        this.#onChange();
      },
      () => undefined,
    );
  }

  /** The still's URL when it shows this format, else null. */
  urlFor(format: ExportFormat): string | null {
    return this.#still?.format === format ? this.#still.url : null;
  }

  /** The sheet closed: no answer in flight is kept, and the URL is revoked. */
  clear(): void {
    this.#request += 1;
    this.#drop();
  }

  #drop(): void {
    if (this.#still !== null) URL.revokeObjectURL(this.#still.url);
    this.#still = null;
  }
}
