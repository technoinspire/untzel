// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// How the composition mounts any skin: what it passes, what it gets back and the
// entries a skin exports. Types only, and no member is optional (the Clean Architecture
// standard in CONTRIBUTING.md: split an interface rather than adding optional members).
import type { Translator } from "@untzel/i18n";
import type { ControlsPort } from "./intents";
import type { MotionChoice } from "./reduced-motion-preference";
/** What the composition passes to any skin. */
export interface SkinOptions {
  readonly root: HTMLElement;
  readonly port: ControlsPort;
  /** The Techno Inspire | Untzel lockup the video mark and card use. */
  readonly exportLogoUrl: string;
  /** The Untzel wordmark, the Graphic Image of the top bar. */
  readonly wordmarkUrl: string;
  /** Mounts the light stage (@untzel/light) into a decorative host. */
  readonly mountStage: (host: HTMLElement) => void;
  /** Mounts the code editor (@untzel/editor) the first time Code opens. */
  readonly mountEditor: (host: HTMLElement) => void;
  /** Mod+Enter outside the editor. */
  readonly onApplyNow: () => void;
  /** The language of the interface. */
  readonly translator: Translator;
  /** The menu's Reduced motion: the page's one source. */
  readonly motion: MotionChoice;
  /** Shown in Help → About. */
  readonly version: string;
}
export interface MountedSkin {
  destroy(): void;
}
/** The "." entry of a skin; Translations is the skin's own catalog type. */
export interface SkinEntry<Translations> {
  readonly createShell: (options: SkinOptions) => MountedSkin;
  readonly addControlsTranslations: (translations: Translations) => void;
}
/** The "./pt-BR" entry of a skin. */
export interface SkinPortugueseEntry<Translations> {
  readonly controlsPortuguese: Translations;
}
