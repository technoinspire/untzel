// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's stretch of music: Selected range (chosen by default), the
// play range's ruler with its handles by steps (export-stretch.ts); Loop or Song, then
// From and To over the parts in a song range, Bars in a loop range; the story has only the
// selected range. Emits useSelectedRange, setExportRangeMode and setExportRange, and the
// stretch's intents; holds no state of its own.
import { button, element, setPressed } from "../dom";
import type { ExportIntents } from "@untzel/skin-contract";
import type { ExportPartOption, ExportView, PlaybackMode } from "@untzel/presentation/view-model";
import { text, type Label } from "../../copy/copy";
import type { ExportSheetModel } from "./export-sheet-model";
import type { ExportStretchControls } from "./export-stretch";

const BAR_CHOICES = [8, 16, 32, 64] as const;

export interface ExportRangeControls {
  readonly root: HTMLElement;
  update(state: ExportView, model: ExportSheetModel): void;
}

const MODES: readonly PlaybackMode[] = ["loop", "song"];

/** The parts' identity for From and To: the options are rebuilt only when it changes. */
export function partsKey(parts: readonly ExportPartOption[]): string {
  return parts.map((part) => `${part.index}:${part.label}`).join("|");
}

type RangeIntents = Pick<ExportIntents, "setExportRange" | "setExportRangeMode" | "useSelectedRange" | "setExportStretch" | "setExportFine" | "useExportPlayRange" | "toggleExportListen">;
// Over 40 lines: one range choice built and updated, nothing else.
export function createExportRange(intents: RangeIntents): ExportRangeControls {
  const selected = button("ui-pill ui-pill--outline ui-export__mode ui-export__selected-mode", text.selectedRange, () => intents.useSelectedRange());
  const modeButtons = MODES.map((mode) => {
    const node = button("ui-pill ui-pill--outline ui-export__mode", mode === "loop" ? text.loop : text.song, () => intents.setExportRangeMode(mode));
    node.dataset["mode"] = mode;
    return node;
  });
  // The Story's other choice: what plays now, about 15 s from the bar that sounds.
  let rangeMode: PlaybackMode = "loop";
  const nowPlaying = button("ui-pill ui-pill--outline ui-export__mode", text.nowPlaying, () => intents.setExportRangeMode(rangeMode));
  const modes = element("div", { className: "ui-export__modes", attributes: { role: "group", "aria-label": text.range } }, [selected, nowPlaying, ...modeButtons]);
  const stretch = lazyExportStretch(intents);
  const from = select("ui-export-from", text.from);
  const to = select("ui-export-to", text.to);
  const bars = select("ui-export-bars", text.bars);
  bars.input.replaceChildren(...BAR_CHOICES.map((count) => element("option", { text: String(count), attributes: { value: count } })));
  const onParts = (): void => intents.setExportRange({ from: Number(from.input.value), to: Number(to.input.value) });
  from.input.addEventListener("change", onParts);
  to.input.addEventListener("change", onParts);
  bars.input.addEventListener("change", () => intents.setExportRange({ bars: Number(bars.input.value) }));
  const song = element("div", { className: "ui-export__range" }, [from.root, to.root]);
  const loop = element("div", { className: "ui-export__range" }, [bars.root]);
  const root = element("div", { className: "ui-export__ranges" }, [modes, stretch.root, song, loop]);
  let shownParts = "";
  return {
    root,
    update(state, model) {
      root.hidden = !model.isRangeShown;
      modes.hidden = !model.isRangeModeShown;
      selected.hidden = !model.isSelectedRangeShown;
      setPressed(selected, state.isPlayRangeChosen);
      rangeMode = state.rangeMode;
      nowPlaying.hidden = state.format !== "story";
      setPressed(nowPlaying, !state.isPlayRangeChosen);
      for (const node of modeButtons) {
        setPressed(node, !state.isPlayRangeChosen && node.dataset["mode"] === state.rangeMode);
        node.hidden = state.format === "story" || (node.dataset["mode"] === "song" && !state.canChooseSong);
      }
      stretch.show(model.isStretchShown ? state : null);
      song.hidden = !model.isRangePickerShown || !model.isSongRange;
      loop.hidden = !model.isRangePickerShown || model.isSongRange;
      const key = partsKey(state.parts);
      if (key !== shownParts) {
        shownParts = key;
        from.input.replaceChildren(...state.parts.map(partOption));
        to.input.replaceChildren(...state.parts.map(partOption));
      }
      if ("from" in state.range) {
        from.input.value = String(state.range.from);
        to.input.value = String(state.range.to);
      } else {
        bars.input.value = String(state.range.bars);
      }
    },
  };
}

interface LazyStretch {
  readonly root: HTMLElement;
  /** null hides it; a view with a stretch shows it, loading the ruler the first time. */
  show(state: ExportView | null): void;
}

/**
 * The stretch's ruler loads the first time it shows (the initial JS budget): until
 * then its place is an empty slot. A chunk that fails is logged and tried on the next show.
 */
function lazyExportStretch(intents: RangeIntents): LazyStretch {
  const root = element("div", { className: "ui-export__stretch-slot" });
  let stretch: ExportStretchControls | null = null;
  let latest: ExportView | null = null;
  let isLoading = false;
  const draw = (): void => {
    root.hidden = latest === null;
    if (stretch !== null && latest !== null && latest.stretch !== null) stretch.update(latest.stretch, latest.format, latest.quality);
  };
  return {
    root,
    show(state) {
      latest = state?.stretch === null ? null : state;
      draw();
      if (stretch !== null || isLoading || latest === null) return;
      isLoading = true;
      import("./export-stretch")
        .then(({ createExportStretch }) => {
          stretch = createExportStretch(intents);
          root.replaceChildren(stretch.root);
          draw();
        })
        .catch((error: unknown) => {
          isLoading = false;
          console.warn("controls: the export range did not load; trying again on the next update", error);
        });
    },
  };
}

function select(id: string, label: Label): { readonly root: HTMLElement; readonly input: HTMLSelectElement } {
  const input = element("select", { className: "ui-export__select", attributes: { id } });
  const root = element("div", { className: "ui-export__field" }, [
    element("label", { className: "ui-export__label", text: label, attributes: { for: id } }),
    input,
  ]);
  return { root, input };
}

function partOption(part: ExportPartOption): HTMLOptionElement {
  return element("option", { text: part.label, attributes: { value: part.index } });
}
