// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project's part of the view model, from the library's records and
// what is open. Pure: the controller passes the state, this words it.
import { livePhrases as phrases, liveStrings as strings } from "@untzel/skin";
import { titleSlug } from "@untzel/core";
import type { ProjectRecord } from "@untzel/session/projects";
import { untzelFileName } from "@untzel/share";
import type { ProjectListItem, ProjectView, SaveState } from "@untzel/presentation/view-model";

export interface ProjectViewState {
  readonly records: readonly ProjectRecord[];
  /** The title the bar shows, or null with no project open. */
  readonly title: string | null;
  /** The stored project open (or waiting for the tap); null for one not saved yet. */
  readonly openId: string | null;
  readonly saveState: SaveState | null;
  readonly isStorageBlocked: boolean;
  /** "124 BPM · 6 tracks" per record, once the engine's code has read it. */
  readonly detailOf: (record: ProjectRecord) => string | null;
  readonly now: Date;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "Edited just now", "Edited 3 min ago", "Edited 5 h ago", else the date. */
export function editedLabel(now: Date, updatedAt: string): string {
  const at = new Date(updatedAt);
  const age = now.getTime() - at.getTime();
  if (!Number.isFinite(age) || age < MINUTE_MS) return phrases.editedAgo(strings.justNow);
  if (age < HOUR_MS) return phrases.editedAgo(phrases.minutesAgo(Math.floor(age / MINUTE_MS)));
  if (age < DAY_MS) return phrases.editedAgo(phrases.hoursAgo(Math.floor(age / HOUR_MS)));
  return phrases.editedAgo(phrases.onDate(at));
}

export function projectFileName(title: string | null, now: Date): string {
  return untzelFileName(titleSlug(title ?? ""), now);
}

export function projectView(state: ProjectViewState): ProjectView {
  const projects: ProjectListItem[] = state.records.map((record) => ({
    id: record.id,
    title: record.title ?? strings.untitled,
    edited: editedLabel(state.now, record.updatedAt),
    detail: state.detailOf(record),
    isOpen: record.id === state.openId,
  }));
  const latest = projects[0];
  return {
    title: state.title,
    saveState: state.saveState,
    fileName: projectFileName(state.title, state.now),
    isStorageBlocked: state.isStorageBlocked,
    projects,
    latest: latest === undefined ? null : { id: latest.id, title: latest.title },
  };
}
