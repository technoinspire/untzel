// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the next tap plays: the selected template, or text received
// from a link or a file ("Remix this"), or a stored project opened from the menu or by
// "Continue <title>".
// Part of the initial JS, so it imports types only besides the idle view.
import type { AppPhase, ReceivedNotice, TemplateCatalogView, UntzelView } from "@untzel/presentation/view-model";
import { idleView } from "@untzel/presentation/waiting";
import type { PlaybackMode, PlayRange } from "@untzel/session";

/** What a tap plays: a template (loop), a stored project, or text from a link or a file. */
export type StartSource =
  | { readonly kind: "template"; readonly name: string }
  | { readonly kind: "project"; readonly id: string }
  | {
      readonly kind: "text";
      readonly source: string;
      readonly origin: "link" | "file";
      /** The sender's mode carried by a link or a file; null without one. */
      readonly mode: PlaybackMode | null;
      /** The play range of that mode; null without one. */
      readonly range: PlayRange | null;
    };

/** Text from a link or a file, with what it carries beside it. */
export interface ReceivedText {
  readonly source: string;
  readonly origin: "link" | "file";
  readonly mode: PlaybackMode | null;
  readonly range: PlayRange | null;
}

/** What the template picker remembers: the project and the style tab last opened. */
export interface TemplateChoice {
  readonly template: string;
  readonly openStyle: string | null;
}

export interface WaitingStageOptions {
  readonly catalog: TemplateCatalogView;
  readonly choice: TemplateChoice;
}

export class WaitingStage {
  #catalog: TemplateCatalogView;
  #selected: string;
  #openStyle: string | null;
  #received: ReceivedText | null = null;
  /** A stored project opened from the menu: the next tap plays it. */
  #project: string | null = null;
  #notice: ReceivedNotice | null = null;

  constructor(options: WaitingStageOptions) {
    this.#catalog = options.catalog;
    this.#selected = options.choice.template;
    this.#openStyle = options.choice.openStyle;
  }

  /** Text that analyzed: the next tap plays it, under "Remix this". */
  receive(received: ReceivedText): ReceivedNotice {
    this.#received = received;
    this.#project = null;
    this.#notice = { kind: "remix", from: received.origin };
    return this.#notice;
  }

  /** A failure notice leaves what was received before in place. */
  setNotice(notice: ReceivedNotice | null): void {
    this.#notice = notice;
  }

  /** Choosing a template leaves a received link behind: the next tap plays the template. */
  selectTemplate(template: string): void {
    this.#selected = template;
    this.#received = null;
    this.#project = null;
    this.#notice = null;
  }
  /** A project waits for the tap; null leaves the templates to choose from (New project…). */
  openProject(id: string | null): void {
    this.#project = id;
    this.#received = null;
    this.#notice = null;
  }

  /** Opening a style tab only changes what the picker lists. */
  openTemplateStyle(style: string): void {
    this.#openStyle = style;
  }

  /** The same library, now with each project's tempo and key. */
  setCatalog(catalog: TemplateCatalogView): void {
    this.#catalog = catalog;
  }

  get choice(): TemplateChoice {
    return { template: this.#selected, openStyle: this.#openStyle };
  }

  /** The tap on the stage: what was received, else the project opened, else the template tapped. */
  tap(template: string): StartSource {
    const received = this.#received;
    if (received !== null) return { kind: "text", ...received };
    if (this.#project !== null) return { kind: "project", id: this.#project };
    this.#selected = template;
    return { kind: "template", name: template };
  }

  view(phase: AppPhase): UntzelView {
    return idleView({
      phase,
      catalog: this.#catalog,
      // A project waiting for the tap is what plays: no template is marked as chosen.
      selected: this.#project === null ? this.#selected : "",
      openStyle: this.#openStyle,
      notice: this.#notice,
    });
  }
}
