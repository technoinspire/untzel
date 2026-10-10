// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Export sheet intents: what the sheet asks for and what it shows.
// Opening the sheet does no work; the choices change nothing but the request, and a
// choice or a text that differs cancels a render in progress. Only Render starts a job,
// which runs in ExportJobs, in its own worker, and never touches the live sound; it is
// keyed by what was asked (export-choices.ts) and its plan frozen when it starts.
// Finished files live in KeptExports until the sheet closes. Selected range is
// the sheet's own stretch (export-stretch.ts), a copy of the play range capped
// per format; it never changes what plays. PreviewStill draws the preview.
import type { ExportIntents, RangeGesture } from "@untzel/skin-contract";
import type { ExportQuality, PlanResult } from "@untzel/export";
import type { PlaybackMode, Session, Unsubscribe } from "@untzel/session";
import { announcements } from "../../../strings/copy";
import { capSeconds, effectiveQuality, planRequest, renderKey, stretchCap, type ExportChoiceState } from "../export-sheet/export-choices";
import { ExportJobs, type ExportApi, type ExportJobOptions, type JobOutcome } from "./export-jobs";
import { readyAnnouncement, refusalMessage } from "../export-sheet/export-labels";
import { ExportListening } from "./export-listening";
import { renderRequest, type JobRequest } from "./export-render-request";
import { isSameFollowedRange, orderedParts, type FollowedRange, type PartRange } from "./export-request";
import { exportView, type ExportSheetState } from "../export-sheet/export-sheet-view";
import { ExportStretchControls } from "../export-sheet/export-stretch-controls";
import { ExportTextFollow } from "../export-sheet/export-text-follow";
import { exportTitleText, type ExportTitleText } from "../export-sheet/export-title";
import { downloadKept, shareKept } from "./kept-export-actions";
import { KeptExports, type KeptExport } from "./kept-exports";
import { PreviewStill, type SceneStill } from "./preview-still";
import type { ExportFormat, ExportQualityName, ExportRangeView, ExportView } from "@untzel/presentation/view-model";

export type { ExportDetails } from "./kept-exports";
export type { SceneStill } from "./preview-still";

export interface ExportControlsOptions extends ExportJobOptions {
  readonly session: Session;
  /** The catalog's "Untitled" in the language of the moment, for a text without a title line. */
  readonly untitled: () => string;
  readonly reducedMotion: () => boolean;
  readonly announce: (message: string) => void;
  /** One still of the scene at a file's size and keep-out, or null without a stage. */
  readonly sceneStill: SceneStill;
}

export class ExportControls implements ExportIntents {
  readonly #options: ExportControlsOptions;
  readonly #listeners = new Set<() => void>();
  readonly #kept = new KeptExports();
  readonly #jobs: ExportJobs;
  readonly #still: PreviewStill;
  #format: ExportFormat = "story";
  /** Null: the highest tier this device renders at real time. */
  #quality: ExportQuality | null = null;
  /** Null: the mode that plays. */
  #rangeMode: PlaybackMode | null = null;
  #songRange: PartRange | null = null;
  #bars = 16;
  /** The play range that plays now; the stretch copies it, chosen again whenever it changes. */
  #playRange: FollowedRange | null = null;
  /** Selected range: the default whenever a play range is set; Loop, Song or Now playing turn it off. */
  #isPlayRangeChosen = false;
  readonly #stretch: ExportStretchControls;
  readonly #listening: ExportListening;
  #message: string | null = null;
  #isVideoUnavailable = false;
  /** A text that differs from the one the open sheet shows cancels a render. */
  readonly #text: ExportTextFollow;

  constructor(options: ExportControlsOptions) {
    this.#options = options;
    this.#listening = new ExportListening(options.session, () => this.#emit());
    this.#jobs = new ExportJobs(options, { onChange: () => this.#emit(), onOutcome: (outcome) => this.#onOutcome(outcome) });
    this.#stretch = new ExportStretchControls({
      session: options.session,
      announce: options.announce,
      cap: () => stretchCap({ format: this.#format, quality: this.#quality }, this.#jobs.api, this.#jobs.deviceProbe()),
      capOf: (format, quality) => capSeconds(this.#jobs.api, format, quality),
    });
    this.#still = new PreviewStill(options.sceneStill, () => this.#emit());
    this.#text = new ExportTextFollow(options.session, () => {
      if (this.#jobs.isRendering) this.#jobs.cancel();
    });
  }

  onChange(listener: () => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  view(): ExportView {
    return exportView(this.#sheetState());
  }

  openExport(): void {
    this.#text.follow();
    this.#jobs.prepare();
    this.#still.request(this.#format);
  }

  selectExportFormat(format: ExportFormat): void {
    if (this.#isVideoUnavailable && format !== "audio") return;
    if (format === this.#format) return;
    this.#format = format;
    this.#stretch.trimToCap();
    this.#still.request(format);
    this.#choiceChanged();
  }
  selectExportQuality(quality: ExportQualityName): void {
    this.#quality = quality;
    this.#stretch.trimToCap();
    this.#choiceChanged();
  }

  setExportRangeMode(mode: PlaybackMode): void {
    this.#rangeMode = mode;
    this.#isPlayRangeChosen = false;
    this.#choiceChanged();
  }
  /** Selected range: the video and the audio start and end where the stretch's handles are. */
  useSelectedRange(): void {
    if (this.#isPlayRangeChosen) return;
    this.#isPlayRangeChosen = true;
    this.#choiceChanged();
  }

  /** A handle of the sheet's ruler: the stretch follows as it moves; said once, on release. */
  setExportStretch(startTick: number, endTick: number, gesture: RangeGesture): void {
    if (!this.#stretch.set(startTick, endTick, gesture)) return;
    this.#isPlayRangeChosen = true;
    this.#choiceChanged();
  }

  setExportFine(isFine: boolean): void {
    this.#stretch.setFine(isFine);
    this.#emit();
  }

  /** Use play range: the copy again (the whole loop or song without a play range). */
  useExportPlayRange(): void {
    if (!this.#stretch.reset()) return;
    this.#isPlayRangeChosen = true;
    this.#choiceChanged();
  }

  setExportRange(range: ExportRangeView): void {
    if ("bars" in range) this.#bars = range.bars;
    else this.#songRange = orderedParts(range);
    this.#choiceChanged();
  }

  /** The range that plays now, or null when it is cleared; a new range is chosen again. */
  followPlayRange(range: FollowedRange | null): void {
    if (isSameFollowedRange(this.#playRange, range)) return;
    this.#playRange = range;
    this.#stretch.follow(range);
    this.#isPlayRangeChosen = range !== null;
    this.#choiceChanged();
  }

  /** Render and Try again: the only way a job starts. */
  renderExport(): void {
    this.#text.follow();
    this.#message = null;
    this.#jobs.start((api) => this.#requestFor(api));
  }

  cancelExport(): void {
    this.#jobs.cancel();
  }

  /** Listen: the stretch the file will hold, from its first bar; again stops. */
  toggleExportListen(): void {
    const result = this.#listening.toggle(this.#stretch.view());
    if (!result.ok) this.#options.announce(announcements.failed(result.code));
  }
  closeExport(): void {
    // Closing forgets the listening; the music goes on as any play does.
    this.#listening.dispose();
    this.#text.stop();
    this.#jobs.cancel();
    this.#kept.clear();
    this.#message = null;
    this.#still.clear();
  }

  /** Inside the click: navigator.share needs the gesture, so nothing is awaited first. */
  shareExport(): void {
    shareKept(this.#shown(), (message) => this.#options.announce(message));
  }

  downloadExport(): void {
    downloadKept(this.#shown(), (message) => this.#options.announce(message));
  }

  /** The finished file the sheet shows, if any (test hooks read the bytes). */
  currentFile(): File | null {
    return this.#shown()?.file ?? null;
  }

  currentDetails(): KeptExport["details"] | null {
    return this.#shown()?.details ?? null;
  }

  dispose(): void {
    this.closeExport();
    this.#listening.dispose();
    this.#jobs.dispose();
    this.#listeners.clear();
  }

  /** A new choice is a new request: a render of the old one stops, and nothing starts. */
  #choiceChanged(): void {
    this.#message = null;
    if (this.#jobs.isRendering) this.#jobs.cancel();
    else this.#emit();
  }

  /** Planned from the position at this moment; the job keeps that plan to the end. */
  #requestFor(api: ExportApi): JobRequest {
    const program = this.#options.session.state().program;
    const quality = effectiveQuality({ quality: this.#quality }, api.chooseTiers(this.#jobs.deviceProbe()));
    // Render fixes the quality: a probe that ends during this job must not move the sheet off it.
    this.#quality = quality;
    return renderRequest({
      program,
      format: this.#format,
      quality,
      isProbed: () => this.#jobs.deviceProbe() !== null,
      plan: (each) => this.#plan(api, this.#format, each),
      keyFor: (sourceHash, each) => this.#keyFor(sourceHash, each),
      title: () => this.#title(),
      isKept: (key) => this.#kept.has(key),
      refusal: (planned) => refusalMessage(planned, api),
      emptyRange: announcements.exportEmptyRange,
    });
  }

  #onOutcome(outcome: JobOutcome): void {
    if (outcome.kind === "done") {
      this.#kept.keep(outcome.kept);
      this.#options.announce(readyAnnouncement(outcome.kept.format));
    } else {
      this.#message = outcome.message;
      this.#isVideoUnavailable ||= outcome.isVideoUnavailable;
    }
    this.#emit();
  }

  #plan(api: ExportApi, format: ExportFormat, quality: ExportQuality): PlanResult {
    const request = planRequest(this.#choices(), format, quality, () => this.#stretch.stretchFor(format, quality));
    return api.planExport(this.#options.session.state().program, request, this.#options.reducedMotion());
  }

  #keyFor(sourceHash: number, quality: ExportQuality): string {
    const format = this.#format;
    return renderKey(this.#choices(), { sourceHash, quality, stretch: () => this.#stretch.stretchFor(format, quality), title: this.#title().text });
  }

  #title(): ExportTitleText {
    return exportTitleText(this.#options.session.view(), this.#options.untitled());
  }

  /** The kept result for what the sheet asks now, if any; the live position does not matter. */
  #shown(): KeptExport | null {
    const api = this.#jobs.api;
    const program = this.#options.session.state().program;
    if (api === null || program === null || this.#jobs.isRendering) return null;
    return this.#kept.find(this.#keyFor(program.sourceHash, effectiveQuality({ quality: this.#quality }, api.chooseTiers(this.#jobs.deviceProbe()))));
  }

  #choices(): ExportChoiceState {
    const stretchMode = (): PlaybackMode | null => this.#stretch.stretchMode;
    const playing = this.#options.session.view();
    return { format: this.#format, quality: this.#quality, rangeMode: this.#rangeMode, isPlayRangeChosen: this.#isPlayRangeChosen, stretchMode, songRange: this.#songRange, bars: this.#bars, playing };
  }

  #sheetState(): ExportSheetState {
    const jobs = this.#jobs;
    return {
      api: jobs.api,
      choices: this.#choices(),
      jobs,
      probe: jobs.deviceProbe(),
      shown: this.#shown(),
      plan: (api, format, quality) => this.#plan(api, format, quality),
      stretch: this.#stretch.view(),
      isListening: this.#listening.isListening,
      isStretchChosen: this.#isPlayRangeChosen && this.#stretch.stretch !== null,
      music: this.#options.session.view(),
      hasProgram: this.#options.session.state().program !== null,
      message: this.#message,
      isVideoUnavailable: this.#isVideoUnavailable,
      previewStill: this.#still.urlFor(this.#format),
    };
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }
}
