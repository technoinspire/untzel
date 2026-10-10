// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The Share sheet's fake (the share screens): a fixed link, or one too long
// for a link; Copy link confirms. Nothing leaves the page.
import type { ShareIntents } from "@untzel/skin-contract";
import type { ShareView } from "@untzel/presentation/view-model";

const LINK = "https://app.untzel.com/#v1.bZDRjoMgEEXf-Yr72CYuBTSmXfsxBKdKUsEARvv3i25NNt19AWbm3JkJmUakfvQIoN0VUi9tPYF8EufYrpEL6X1zR8ZG5zz0qU7SK2o";

export interface FakeShareOptions {
  readonly link: "ready" | "too-long";
  readonly announce: (message: string) => void;
  readonly emit: () => void;
}

export class FakeShare implements ShareIntents {
  readonly #options: FakeShareOptions;
  #isCopied = false;

  constructor(options: FakeShareOptions) {
    this.#options = options;
  }

  view(): ShareView {
    return {
      link: this.#options.link === "ready" ? { kind: "ready", url: LINK, length: LINK.length } : { kind: "too-long", length: 9_412 },
      isLastValid: false,
      canShareLink: true,
      canShareFile: true,
      isCopied: this.#isCopied,
      isCopyRefused: false,
    };
  }

  prepareShare(): void {
    this.#isCopied = false;
    this.#options.emit();
  }

  closeShare(): void {}

  shareLink(): void {
    this.#options.announce("Shared.");
  }

  copyLink(): void {
    this.#isCopied = true;
    this.#options.announce("Link copied.");
    this.#options.emit();
  }

  saveFile(): void {
    this.#options.announce("Saved.");
  }

  shareFile(): void {
    this.#options.announce("Shared.");
  }

  openFile(file: File): void {
    this.#options.announce(`${file.name} plays on the next bar.`);
  }
}
