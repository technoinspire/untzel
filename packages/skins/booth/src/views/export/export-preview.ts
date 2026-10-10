// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's preview shows what the file contains.
// Before the render: a still of the scene being heard, drawn the way the file draws it (the
// composition's object URL; the bare stage until it arrives), with the brand mark where the
// video carries it, and beside it the 2 s closing card with the logo and the URL, placed by
// the layout the composition passes (@untzel/export's brandLayout, no number copied into the
// CSS). Audio shows a waveform: the WAV has no picture. Once the
// render is done, the preview is the file itself, with controls and no autoplay.
import { element, setText, setVar } from "../dom";
import type { ExportPreviewLayout, ExportResultView, ExportView } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";
import type { ExportSheetModel } from "./export-sheet-model";

const WAVE_BARS = 48;
const URL_TEXT = "untzel.com";

export interface ExportPreview {
  readonly root: HTMLElement;
  update(state: ExportView, model: ExportSheetModel): void;
}

const percent = (fraction: number) => `${round(fraction * 100)}%`;
const containerWidth = (fraction: number) => `${round(fraction * 100)}cqw`;
const round = (value: number) => Math.round(value * 1000) / 1000;

/** The layout as the custom properties export-preview.css reads. */
export function previewVars(layout: ExportPreviewLayout): Readonly<Record<string, string>> {
  return {
    "--frame-ratio": String(round(layout.aspect)),
    "--scrim-left": percent(layout.scrim.left),
    "--scrim-top": percent(layout.scrim.top),
    "--scrim-width": percent(layout.scrim.width),
    "--scrim-height": percent(layout.scrim.height),
    "--scrim-radius": containerWidth(layout.scrimRadius),
    "--mark-logo-left": percent(layout.markLogo.left),
    "--mark-logo-top": percent(layout.markLogo.top),
    "--mark-logo-width": percent(layout.markLogo.width),
    "--mark-url-top": percent(layout.markUrl.top),
    "--mark-url-size": containerWidth(layout.markUrl.size),
    "--mark-url-center": percent(layout.markUrl.center),
    // No clearance: a cut of radius 0, so the mask is whole.
    "--rings-x": percent(layout.ringsClearance?.centerX ?? 0.5),
    "--rings-y": percent(layout.ringsClearance?.centerY ?? 0.5),
    "--rings-inner": containerWidth(layout.ringsClearance?.inner ?? 0),
    "--rings-outer": containerWidth(layout.ringsClearance?.outer ?? 0),
    "--card-logo-left": percent(layout.cardLogo.left),
    "--card-logo-top": percent(layout.cardLogo.top),
    "--card-logo-width": percent(layout.cardLogo.width),
    "--card-url-top": percent(layout.cardUrl.top),
    "--card-url-size": containerWidth(layout.cardUrl.size),
    "--card-url-center": percent(layout.cardUrl.center),
  };
}

// Over 40 lines: one preview built and updated, nothing else.
export function createExportPreview(logoUrl: string): ExportPreview {
  const still = element("img", { className: "ui-preview__still", attributes: { alt: "" } });
  still.hidden = true;
  const wave = element(
    "span",
    { className: "ui-preview__wave", attributes: { "aria-hidden": "true" } },
    Array.from({ length: WAVE_BARS }, (_, index) => {
      const bar = element("span", { className: "ui-preview__wave-bar" });
      setVar(bar, "--level", waveLevel(index));
      return bar;
    }),
  );
  const frame = element("span", { className: "ui-preview__frame", attributes: { "aria-hidden": "true" } }, [
    element("span", { className: "ui-preview__art" }, [still]),
    wave,
    element("span", { className: "ui-preview__mark" }, [
      element("span", { className: "ui-preview__scrim" }),
      logo(logoUrl, "ui-preview__mark-logo"),
      element("span", { className: "ui-preview__mark-url", text: URL_TEXT }),
    ]),
  ]);
  const card = element("span", { className: "ui-preview__card", attributes: { "aria-hidden": "true" } }, [
    element("span", { className: "ui-preview__card-frame" }, [
      logo(logoUrl, "ui-preview__card-logo"),
      element("span", { className: "ui-preview__card-url", text: URL_TEXT }),
    ]),
    element("span", { className: "ui-preview__card-length", text: text.cardLength }),
  ]);
  const drawn = element("span", { className: "ui-preview__drawn" }, [frame, card]);
  const file = element("span", { className: "ui-preview__file" });
  const caption = element("figcaption", { className: "ui-visually-hidden" });
  const root = element("figure", { className: "ui-preview" }, [drawn, file, caption]);
  let shownUrl: string | null = null;
  return {
    root,
    update(state, model) {
      const result = model.isResultShown ? state.result : null;
      drawn.hidden = result !== null;
      file.hidden = result === null;
      if ((result?.url ?? null) !== shownUrl) {
        shownUrl = result?.url ?? null;
        file.replaceChildren(...(result === null ? [] : [player(result)]));
      }
      const source = stillSource(state);
      if (source !== null && still.getAttribute("src") !== source) still.setAttribute("src", source);
      still.hidden = source === null;
      if (state.preview !== null) for (const [name, value] of Object.entries(previewVars(state.preview))) setVar(root, name, value);
      setText(caption, result !== null ? strings.previewResult : state.format === "audio" ? strings.previewAudio : strings.previewVideo);
    },
  };
}

/** The scene's still for the drawn preview: none for Audio, whose file has no picture. */
export function stillSource(state: Pick<ExportView, "format" | "previewStill">): string | null {
  return state.format === "audio" ? null : state.previewStill;
}
/** The finished file: it waits for play, so it never doubles the music that keeps playing. */
function player(result: ExportResultView): HTMLMediaElement {
  const media = element(result.kind, {
    className: `ui-preview__player ui-preview__player--${result.kind}`,
    attributes: { src: result.url, controls: true, preload: "metadata", playsinline: result.kind === "video" },
  });
  media.autoplay = false;
  return media;
}

function logo(src: string, className: string): HTMLImageElement {
  return element("img", { className, attributes: { src, alt: "", width: 903, height: 263 } });
}

/** Deterministic decorative waveform for the Audio preview, 0.2..1. */
export function waveLevel(index: number): number {
  const value = Math.abs(Math.sin(index * 0.9) * 0.6 + Math.sin(index * 0.23) * 0.4);
  return Math.round((0.2 + value * 0.8) * 100) / 100;
}
