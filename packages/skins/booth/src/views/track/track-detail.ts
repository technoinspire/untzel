// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setPressed } from "../dom";
import type { AuditionIntents, BarIntents, MixIntents, PatternIntents, RenameIntents, SessionIntents, SoundIntents, TrackIntents } from "@untzel/skin-contract";
import type { TrackView, UntzelView } from "@untzel/presentation/view-model";
import type { PreviewSoundsSetting } from "../../behavior/preferences/preview-sounds-setting";
import { text } from "../../copy/copy";
import type { EditingBarView } from "../range/range-ruler-model";
import { createSheet, type Sheet } from "../sheets/sheet";
import { createPatternChips } from "../pattern/pattern-chips";
import { createTrackDetailHeader } from "./track-detail-header";
import { createTrackMixGroup } from "./track-mix-group";
import { createTrackSoundGroup } from "./track-sound-group";
import { createTrackStepsGroup, type TrackStepsOptions } from "./track-steps-group";

/** A touched step sounds only with Preview sounds on, read at the touch. */
export function shouldAudition(isPreviewOn: boolean, sound: unknown): boolean {
  return isPreviewOn && sound !== null;
}

export interface TrackDetailOptions extends TrackStepsOptions {
  readonly onClose: () => void;
  readonly onDuplicated: (track: string) => void;
  /** After Delete: the shell offers Undo. */
  readonly onDeleted: (track: string) => void;
  /** "Preview sounds", the same setting the menu turns. */
  readonly previewSounds: PreviewSoundsSetting;
  /** Change sound: the library opens in replace mode for this track. */
  readonly onChangeSound: (track: string) => void;
  /** A gesture took `what` out of the text ("open", "gain signal"): the shell offers Undo. */
  readonly onRemoved: (what: string) => void;
  /** The name field renamed the track shown: the shell keeps the detail on it. */
  readonly onRenamed: (track: string) => void;
}

export interface TrackDetail extends Sheet {
  /** The Pattern chip, which the length picker returns focus to. */
  readonly length: HTMLButtonElement;
  /** Change sound, where the library returns focus. */
  readonly changeSound: HTMLButtonElement;
  editName(): void;
  /** The bar in edit and its pattern's length, for the range ruler; null without a track. */
  editing(): EditingBarView | null;
  /** null closes the detail. */
  update(view: UntzelView, track: string | null, isDesktop: boolean, isLengthOpen: boolean): void;
}

type DetailIntents = TrackIntents & BarIntents & AuditionIntents & SoundIntents & RenameIntents & MixIntents & PatternIntents & Pick<SessionIntents, "endGesture">;

/**
 * The track detail: every step and every sound of one track. The bars are thumbnails
 * and the grid shows the bar being edited (bar-editor.ts), and a melodic step opens the
 * note picker (note-picker.ts) instead of a row of the key's seven notes.
 */
// Over 40 lines: one sheet built and updated; its groups are their own views.
export function createTrackDetail(intents: DetailIntents, options: TrackDetailOptions): TrackDetail {
  const sheet = createSheet({ id: "ui-detail", title: "", className: "ui-sheet--detail", onClose: options.onClose });
  const header = createTrackDetailHeader(sheet, {
    previewSounds: options.previewSounds,
    onRename: (track, name) => {
      intents.renameTrack(track, name);
      options.onRenamed(name);
    },
    announce: options.announce,
  });
  let current: TrackView | null = null;
  const name = (): string => current?.name ?? "";

  const solo = button("ui-pill ui-pill--raised", text.solo, () => intents.setSolo(name(), !(current?.isSoloed ?? false)));
  const mute = button("ui-pill ui-pill--raised", text.mute, () => intents.setMute(name(), !(current?.isMuted ?? false)));
  // "Preview sounds": every touched note sounds unless turned off.
  const steps = createTrackStepsGroup(intents, () => current, (sound) => {
    if (shouldAudition(header.isPreviewOn(), sound) && current !== null && sound !== null) intents.audition(current.name, sound);
  }, options);
  const patterns = createPatternChips(intents);
  const sound = createTrackSoundGroup(intents, name, () => options.onChangeSound(name()), options.onRemoved);
  const mix = createTrackMixGroup(intents, name, options.onRemoved);
  const duplicate = button("ui-pill ui-pill--raised", text.duplicate, () => options.onDuplicated(intents.duplicateTrack(name())));
  const remove = button("ui-pill ui-pill--danger", text.delete, () => {
    const deleted = name();
    intents.deleteTrack(deleted);
    options.onClose();
    options.onDeleted(deleted);
  });

  sheet.body.append(
    element("div", { className: "ui-detail__toggles" }, [solo, mute]),
    patterns.root,
    ...steps.nodes,
    ...sound.nodes,
    ...mix.nodes,
  );
  sheet.root.append(element("div", { className: "ui-detail__footer" }, [duplicate, remove]));

  return {
    ...sheet,
    length: steps.length,
    changeSound: sound.changeSound,
    editName: () => header.editName(),
    editing: () => (current === null ? null : { bar: steps.editingBar(), patternBars: current.bars }),
    update(next, trackName, isDesktopLayout, isLengthOpen) {
      const track = next.tracks.find((t) => t.name === trackName) ?? null;
      if (track === null) {
        current = null;
        return;
      }
      if (current !== null && current.name !== track.name) steps.leave();
      current = track;
      header.update(track, new Set(next.tracks.map((entry) => entry.name).filter((entry) => entry !== track.name)));
      patterns.update(track);
      sound.updateHeader(track);
      setPressed(solo, track.isSoloed);
      setPressed(mute, track.isMuted);
      steps.update(track, next, isDesktopLayout, isLengthOpen);
      // The rows outlive the track they were made for (they are rebuilt only when the
      // parameter names change), so a gesture reads the track shown now. Capturing
      // track.name here once bound every Mix slider to the first track opened, and every
      // Sound slider to the first track of its instrument.
      sound.updateBody(track);
      mix.update(track);
    },
  };
}
