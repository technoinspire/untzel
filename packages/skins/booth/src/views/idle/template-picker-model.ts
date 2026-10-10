// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Pure presentation of the template picker: the styles in alphabetical order, each
// with how many projects it has, and the projects of the open style as cards with their
// tempo and key. No DOM, so it is unit tested on its own.

import { pitchClassName } from "@untzel/core";
import { phrases, strings } from "../../copy/copy";
import { formatKey } from "../../behavior/text/format";
import type { TemplateCatalogView, TemplateSummaryView } from "@untzel/presentation/view-model";

export interface StyleOption {
  readonly id: string;
  /** "House · 3 projects". */
  readonly label: string;
  readonly isOpen: boolean;
}

export interface ProjectCard {
  readonly template: string;
  readonly name: string;
  /** "125 BPM · F major"; null until the template is analyzed. */
  readonly detail: string | null;
  readonly isSelected: boolean;
}

export interface TemplatePickerModel {
  /** The Blank project, first and outside the styles; null without one. */
  readonly blank: ProjectCard | null;
  /** Every style with a project, in alphabetical order of its name. */
  readonly styles: readonly StyleOption[];
  /** "" when the catalog has no style. */
  readonly openStyle: string;
  readonly cards: readonly ProjectCard[];
}

export interface TemplateSelection {
  readonly template: string;
  /** The style asked for; null, or a style without projects, opens the selected template's style. */
  readonly openStyle: string | null;
}

/** Style names compare as a person reads a list: "acid techno" next to "Acid techno", "Afro" after "Acid". */
const BY_NAME = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/**
 * Every style that has a project, alphabetically (twelve styles no longer fit one
 * row of tabs, and a long list is read by name), and the open style's cards. The
 * first-touch style still opens first: it is the selected template's.
 */
export function templatePickerModel(catalog: TemplateCatalogView, selection: TemplateSelection): TemplatePickerModel {
  const projectsOf = (style: string): number => catalog.projects.filter((project) => project.style === style).length;
  const styles = catalog.styles.filter((style) => projectsOf(style.id) > 0).sort((a, b) => BY_NAME.compare(a.label, b.label));
  const selectedStyle = catalog.projects.find((project) => project.id === selection.template)?.style ?? null;
  const openStyle = (styles.find((style) => style.id === selection.openStyle) ?? styles.find((style) => style.id === selectedStyle) ?? styles[0])?.id ?? "";
  const blank = catalog.blank;
  return {
    blank:
      blank === null
        ? null
        : {
            template: blank.id,
            // Not a project name: the root template recognized by its id, named in the current language.
            name: strings.blank,
            detail: blank.summary === null ? strings.noTracks : `${strings.noTracks} · ${summaryDetail(blank.summary)}`,
            isSelected: blank.id === selection.template,
          },
    openStyle,
    styles: styles.map((style) => ({ id: style.id, label: phrases.styleOption(style.label, projectsOf(style.id)), isOpen: style.id === openStyle })),
    cards: catalog.projects
      .filter((project) => project.style === openStyle)
      .map((project) => ({
        template: project.id,
        name: project.name,
        detail: project.summary === null ? null : summaryDetail(project.summary),
        isSelected: project.id === selection.template,
      })),
  };
}

/** "125 BPM · f major": the key written as the text and the transport write it (formatKey). */
export function summaryDetail(summary: TemplateSummaryView): string {
  const bpm = Number.isInteger(summary.bpm) ? String(summary.bpm) : summary.bpm.toFixed(1);
  return `${bpm} BPM · ${formatKey(pitchClassName(summary.key.tonic), summary.key.scale)}`;
}

/** The waiting stage's play button: Blank selected, it opens an empty project instead of playing. */
export function idlePlayLabels(isBlank: boolean): { readonly label: string; readonly hint: string } {
  return isBlank
    ? { label: strings.startFromScratch, hint: strings.blankHint }
    : { label: strings.tapToPlay, hint: strings.startsOnNextBar };
}
