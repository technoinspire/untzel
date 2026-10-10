// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ViewSource } from "@untzel/skin-contract";
import type { InstrumentRegistry } from "@untzel/core";
import { presentView } from "@untzel/presentation";
import type { Audition, PlayRanges, Session, Unsubscribe } from "@untzel/session";
import { PRESENTATION_COPY } from "../presentation-copy";
import type { ControlsFeedback } from "./feedback";
import type { ExportView, ShareView, TemplateCatalogView, UntzelView } from "@untzel/presentation/view-model";

type Listener<T> = (value: T) => void;

/** The page state the Share and Export sheets show; none of it is part of the text. */
export interface SheetStates {
  readonly share: { view(): ShareView; onChange(listener: () => void): Unsubscribe };
  readonly export: { view(): ExportView; onChange(listener: () => void): Unsubscribe };
}

export interface ViewSourceOptions {
  readonly session: Session;
  readonly feedback: ControlsFeedback;
  /** The library redraws when an audition starts or ends. */
  readonly audition: Audition;
  /** The play range: playback state beside the session's view. */
  readonly ranges: Pick<PlayRanges, "view" | "subscribe">;
  readonly registry: InstrumentRegistry;
  readonly templates: TemplateCatalogView;
  readonly selectedTemplate: string;
  /** Frame the context renders now; null before the first sound. */
  readonly nowFrame: () => number | null;
  readonly sampleRate: number;
  readonly sheets: SheetStates;
}

/** What the screens render: the session's view described for the controls, plus the sheets' state. */
export class SessionViewSource implements ViewSource {
  readonly #options: ViewSourceOptions;
  readonly #listeners = new Set<Listener<UntzelView>>();
  readonly #changeListeners = new Set<() => void>();
  readonly #unsubscribe: Unsubscribe[];

  constructor(options: ViewSourceOptions) {
    this.#options = options;
    this.#unsubscribe = [
      options.session.subscribe(() => this.#emit()),
      options.sheets.share.onChange(() => this.#emit()),
      options.sheets.export.onChange(() => this.#emit()),
      options.audition.onChange(() => this.#emit()),
      options.ranges.subscribe(() => this.#emit()),
    ];
  }

  view(): UntzelView {
    const { session, registry, templates, selectedTemplate, nowFrame, sampleRate, sheets, audition, ranges } = this.#options;
    return presentView(session.view(), {
      registry,
      audition: audition.current(),
      templates,
      selectedTemplate,
      share: sheets.share.view(),
      export: sheets.export.view(),
      playRange: ranges.view(),
      nowFrame: nowFrame(),
      sampleRate,
      labels: PRESENTATION_COPY.labels,
      descriptions: PRESENTATION_COPY.descriptions,
    });
  }

  subscribe(listener: Listener<UntzelView>): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** That the view changed, without describing it: the page draws it once per frame. */
  onChange(listener: () => void): Unsubscribe {
    this.#changeListeners.add(listener);
    return () => this.#changeListeners.delete(listener);
  }

  onAnnouncement(listener: Listener<string>): Unsubscribe {
    return this.#options.feedback.onAnnouncement(listener);
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe) unsubscribe();
    this.#listeners.clear();
    this.#changeListeners.clear();
  }

  #emit(): void {
    for (const listener of this.#changeListeners) listener();
    if (this.#listeners.size === 0) return;
    const view = this.view();
    for (const listener of this.#listeners) listener(view);
  }
}
