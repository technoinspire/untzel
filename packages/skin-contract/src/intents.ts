// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { ScaleName, StepPitch } from "@untzel/core";
import type { AuditionSound, PlaybackMode, Unsubscribe } from "@untzel/session";
import type { ExportFormat, ExportQualityName, ExportRangeView, UndoNotice, UntzelView } from "@untzel/presentation/view-model";
import type { ProjectIntents } from "./project-intents";
export type { AuditionSound };

// Everything the controls ask for. The session turns each intent into a minimal text
// edit or a transport command; controls never touch the source.
// Split by reason to change so no interface passes the operation budget.

export interface ViewSource {
  view(): UntzelView;
  subscribe(listener: (view: UntzelView) => void): Unsubscribe;
  /** Polite announcements for the aria-live region. */
  onAnnouncement(listener: (message: string) => void): Unsubscribe;
}

export interface SessionIntents {
  /** The first gesture: unlocks audio and plays the template on the next bar. */
  start(template: string): void;
  selectTemplate(template: string): void;
  /** The template picker's style tab; remembered with the selected template. */
  openTemplateStyle(style: string): void;
  retry(): void;
  /** What the step changed, for the toast ("Undid: gain on hat"); null when nothing was undone. */
  undo(): UndoNotice | null;
  redo(): UndoNotice | null;
  /** A drag ended or an editor closed: the next gesture is an undo step of its own. */
  endGesture(): void;
}

export interface PlaybackIntents {
  togglePlay(): void;
  stop(): void;
  setMode(mode: PlaybackMode): void;
  /** Loop mode: 4-bar rise, then every track enters. */
  drop(): void;
  /** Loop mode: 1..16 bars per pass, written as `loop <bars>`; enters on the next bar. */
  setLoopBars(bars: number): void;
}

export interface TrackIntents {
  toggleTrack(track: string): void;
  /** Held tile: solo while held. */
  setSolo(track: string, isSoloed: boolean): void;
  setMute(track: string, isMuted: boolean): void;
  /** 0..1, continuous. */
  setTone(track: string, tone: number): void;
  /** `bar` is 0-based: the bar picked in the track detail. */
  toggleStep(track: string, bar: number, step: number): void;
  /** The note picker: any note, a chord, a hold or a rest. */
  setStepPitch(track: string, bar: number, step: number, pitch: StepPitch): void;
  /** Scale lock: on, notes move to the key; off writes `free` on the track. */
  setScaleLock(track: string, isLocked: boolean): void;
  /** 8, 16 or 32 steps in every bar. */
  setStepCount(track: string, count: number): void;
  /** 1..16 bars; new bars repeat the last one. */
  setBars(track: string, bars: number): void;
  /** fraction 0..1, mapped through the manifest curve by the session. */
  setParameter(track: string, parameter: string, fraction: number): void;
  duplicateTrack(track: string): string;
  deleteTrack(track: string): void;
}

/** Names edited where they are shown. */
export interface RenameIntents {
  /** One edit: the track line and every section that names it. */
  renameTrack(track: string, newName: string): void;
  /** One edit: the section line and every use in the song. */
  renameSection(section: string, newName: string): void;
}

/** Tone handed back and the gain fader. */
export interface MixIntents {
  /** Removes the written parameters that override tone; returns their names for the toast. */
  useTone(track: string): readonly string[];
  /** The arrow keys of the fader: `steps` of 0.5 dB. */
  nudgeGain(track: string, steps: number): void;
  /** Double tap or double click: 0 dB (`gain 1`). */
  resetGain(track: string): void;
}

/** The song's tempo and key from the transport; both enter on the next bar. */
export interface StatementIntents {
  setTempo(bpm: number): void;
  /** `tonic` as the text writes it: "c", "f#", "eb". */
  setKey(tonic: string, scale: ScaleName): void;
}

/** The pattern chips of the track detail. */
export interface PatternIntents {
  /** The track plays the pattern in the music from the next bar; the text does not change. */
  previewPattern(track: string, pattern: string): void;
  /** Writes the pattern on the track, in the music's key; one undo step. */
  usePattern(track: string, pattern: string): void;
  /** Cancel, Esc, closing: the track plays the text again on the next bar. */
  endTrackPreview(): void;
}

/**
 * Every note the person touches sounds at once, on the track's own instrument.
 * Never edits the text, never moves the transport.
 */
export interface AuditionIntents {
  audition(track: string, sound: AuditionSound): void;
}

/** The bar actions of the track detail. `bar` is 0-based. */
export interface BarIntents {
  /** Copy bar: keeps the bar's elements for Paste here; false when nothing was copied. */
  copyBar(track: string, bar: number): boolean;
  /** Paste here: the copied elements replace this bar. */
  pasteBar(track: string, bar: number): void;
  /** Clear bar: every step of the bar becomes a rest. */
  clearBar(track: string, bar: number): void;
}

/** The sound group of the track detail. */
export interface SoundIntents {
  /** null is the default sound. */
  setSound(track: string, sound: string | null): void;
  addEffect(track: string, effect: string): void;
  removeEffect(track: string, effect: string): void;
  /** Change sound: the track plays another instrument in the music; the text does not change. */
  previewTrackSound(track: string, instrument: string, sound: string | null): void;
  /** Change sound: another instrument and sound, keeping the pattern; one undo step. */
  setTrackSound(track: string, instrument: string, sound: string | null): void;
}

/** The Add track library: listen first, then add with the chosen sound. */
export interface LibraryIntents {
  /** Plays the instrument in the music's key and tempo; `sound` null is the default one, `pattern` null the preview. */
  preview(instrument: string, sound: string | null, pattern?: string | null): void;
  stopPreview(): void;
  /** Returns the new track name (next free name, for example "hat2"); `pattern` null is the first. */
  addTrack(instrument: string, sound: string | null, pattern?: string | null): string;
  /** The empty state's starters: adds the instrument with its first pattern and plays. */
  startWithSound(instrument: string): string;
}

/**
 * The play range: which bars play, in Loop and in Song. Bars
 * are 1-based, as the ruler shows them; parts are indexes. Every change enters on the
 * next bar and never stops the music; none of them edits the text.
 */
/**
 * How a range changed: "drag" while a handle moves, "release" when a drag or a second tap
 * ends, "key" for a key on a handle. A key change is not announced: the slider already
 * says its value (one announcement per change, never one per key).
 */
export type RangeGesture = "drag" | "release" | "key";
export interface RangeIntents {
  /** A handle released or moved by a key, or two bars tapped. */
  setPlayRange(startBar: number, endBar: number, gesture: RangeGesture): void;
  clearPlayRange(): void;
  /** Song mode: on repeats the range, off plays on into the song. */
  setRangeCycle(cycle: boolean): void;
  /** The bracket button of a part row: the range becomes that part. */
  setRangeToPart(part: number): void;
  /** To here: the range grows to the part. */
  extendRangeToPart(part: number): void;
  /** Play from here: moves only the start; the music goes there on the next bar. */
  playFrom(bar: number): void;
  /** The part editor's Play from here: from the part's first bar, in song mode. */
  playFromPart(part: number): void;
  /** A part row's Play: that part repeats alone from the next bar; again on it clears the range. */
  playPart(part: number): void;
}
/** The Song view: parts in playing order and the part editor. */
export interface SongIntents {
  /** A track on or off in a part: edits the part's section line. */
  toggleSectionMember(section: string, track: string): void;
  addPartFromPlaying(): void;
  setPartBars(part: number, bars: number): void;
  /** -1 earlier in the song, +1 later. */
  movePart(part: number, delta: -1 | 1): void;
  duplicatePart(part: number): void;
}

export interface ShareIntents {
  /** The Share sheet opened: build the link, and build it again whenever the text changes. */
  prepareShare(): void;
  /** The Share sheet closed: stop following the text. */
  closeShare(): void;
  /** navigator.share with the link, inside the click. */
  shareLink(): void;
  copyLink(): void;
  /** Saves the current text, even when it does not play (work in progress). */
  saveFile(): void;
  /** navigator.share with a .untzel file of the last version that plays. */
  shareFile(): void;
  /** From the file picker or a drop; works on the waiting stage too. */
  openFile(file: File): void;
}

/** The sheet's choices: none of them renders; a choice that differs cancels a render in progress. */
export interface ExportChoiceIntents {
  selectExportFormat(format: ExportFormat): void;
  selectExportQuality(quality: ExportQualityName): void;
  /** Loop or Song: the stretch of music the video and the audio cover. */
  setExportRangeMode(mode: PlaybackMode): void;
  /** Selected range: the stretch is the play range, from its start bar to its end bar. */
  useSelectedRange(): void;
  setExportRange(range: ExportRangeView): void;
}

/**
 * The export's stretch: the play range's ruler in the sheet,
 * finer than a bar. Ticks are 1/64 of a bar from the ruler's left edge, half-open. It
 * changes only what is exported, never what plays.
 */
export interface ExportStretchIntents {
  setExportStretch(startTick: number, endTick: number, gesture: RangeGesture): void;
  /** Fine: the handles snap to 1/64 instead of 1/16. */
  setExportFine(isFine: boolean): void;
  /** Back to a copy of the play range (or the whole loop or song). */
  useExportPlayRange(): void;
  /** Listen: plays the stretch from its first bar and stops after its last; again stops. */
  toggleExportListen(): void;
}
/** The sheet's work: opening does none; only Render (and Try again) starts a job. */
export interface ExportJobIntents {
  /** The sheet opened: show the choices. No capture, no render, no worker. */
  openExport(): void;
  renderExport(): void;
  cancelExport(): void;
  shareExport(): void;
  downloadExport(): void;
  /** The sheet closed: cancel the render and drop every result (no background export). */
  closeExport(): void;
}

export interface ExportIntents extends ExportChoiceIntents, ExportStretchIntents, ExportJobIntents {}

export interface ControlsPort
  extends ViewSource,
    ProjectIntents,
    SessionIntents,
    PlaybackIntents,
    TrackIntents,
    RenameIntents,
    MixIntents,
    StatementIntents,
    PatternIntents,
    BarIntents,
    AuditionIntents,
    LibraryIntents,
    SoundIntents,
    SongIntents,
    RangeIntents,
    ShareIntents,
    ExportIntents {}
