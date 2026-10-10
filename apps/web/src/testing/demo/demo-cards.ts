// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The demo video's two cards, drawn by the export's own
// functions at the capture's pixel size: the song's title card over the stage colour for the
// first 45 frames, and the 2 s closing card of the brand after the last gesture.
// A card covers the whole page; nothing under it is read while it is up.
import { prepareTitleOverlays, prepareVideoBranding, type FrameSize } from "@untzel/export";
import type { ExportTitleText } from "../../adapters/controls/export-sheet/export-title";

export interface DemoCards {
  showTitle(title: Pick<ExportTitleText, "text" | "detail">): Promise<void>;
  showBrand(): Promise<void>;
  hide(): void;
}

/** The capture's pixels: the viewport at the device pixel ratio of the format. */
function captureSize(): FrameSize {
  return { width: Math.round(innerWidth * devicePixelRatio), height: Math.round(innerHeight * devicePixelRatio) };
}

function cardCanvas(host: HTMLElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.dataset["demoCard"] = "";
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", zIndex: "2147483646", pointerEvents: "none" });
  canvas.hidden = true;
  host.append(canvas);
  return canvas;
}

export function createDemoCards(host: HTMLElement, logoUrl: string): DemoCards {
  const canvas = cardCanvas(host);
  const paint = (bitmap: ImageBitmap, background: string | null): void => {
    const size = captureSize();
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("no 2D context for the demo card");
    if (background !== null) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, size.width, size.height);
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    canvas.hidden = false;
  };
  return {
    async showTitle(title) {
      const prepared = await prepareTitleOverlays({ fonts: document.fonts, frame: captureSize(), title: title.text, detail: title.detail });
      if (!prepared.ok) throw new Error(`the title card needs its font: ${prepared.reason}`);
      prepared.overlays.caption.close();
      const stage = getComputedStyle(document.documentElement).getPropertyValue("--stage").trim();
      paint(prepared.overlays.card, stage === "" ? "#000" : stage);
    },
    async showBrand() {
      const prepared = await prepareVideoBranding({ fonts: document.fonts, logoUrl, frame: captureSize() });
      if (!prepared.ok) throw new Error(`the closing card needs its ${prepared.reason}`);
      prepared.branding.mark.close();
      paint(prepared.branding.card, null);
    },
    hide() {
      canvas.hidden = true;
    },
  };
}
