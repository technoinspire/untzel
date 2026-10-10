// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What a tap starts from: a template plays in loop; a stored project in the mode it was
// left in, else the session's default; received text in the mode it carries, else by the
// mode fallback. A project, a link or a file also brings the play range of that mode.
// Every new song has a title line: a blank one gets "Untitled", a link "Remix of <title>".
// Text that does not analyze gives way to the first-touch template in loop, with a notice
// that says why.
import type { AnalyzeResult } from "@untzel/language";
import type { PlaybackMode } from "@untzel/session";
import { carriedRange, openingMode, type CarriedRange } from "@untzel/session/opening-mode";
import type { ProjectRecord } from "@untzel/session/projects";
import { announcements } from "../../strings/copy";
import { rejection } from "../received/received-source";
import type { StartSource } from "../waiting/waiting-stage";

/** Which project the text belongs to: a stored one, or a new one created at the first save. */
export interface StartProject {
  readonly id: string | null;
  readonly templateOrigin: string | null;
}

export interface FirstText {
  readonly source: string;
  /** Templates play in loop on the first tap; received text and projects in their opening mode; null: the session's default. */
  readonly mode: PlaybackMode | null;
  /** The play range that came with the project, the link or the file; null without one. */
  readonly range: CarriedRange | null;
  readonly notice: string | null;
  readonly project: StartProject;
}

export interface FirstTextSources {
  readonly analyze: (source: string) => AnalyzeResult;
  readonly template: (name: string) => Promise<string>;
  /** The first-touch template (`// default: true`), played when received text cannot play. */
  readonly fallback: string;
  readonly project: (id: string) => Promise<ProjectRecord | null>;
  /** The text with "Untitled" when it has no title line (a blank project). */
  readonly untitled: (source: string) => string;
  /** The text titled "Remix of <title>" (a received link). */
  readonly remix: (source: string) => string;
}

const NEW_PROJECT: StartProject = { id: null, templateOrigin: null };

export async function firstTextOf(start: StartSource, sources: FirstTextSources): Promise<FirstText> {
  if (start.kind === "template") {
    const source = sources.untitled(await sources.template(start.name));
    return { source, mode: "loop", range: null, notice: null, project: { id: null, templateOrigin: start.name } };
  }
  if (start.kind === "project") {
    const record = await sources.project(start.id);
    if (record === null) return fallback(sources, announcements.savedFailed);
    return { source: record.source, ...projectPlayback(record, sources), notice: null, project: { id: record.id, templateOrigin: record.templateOrigin } };
  }
  const result = sources.analyze(start.source);
  if (result.ok) {
    const source = start.origin === "link" ? sources.remix(start.source) : start.source;
    return { source, mode: openingMode(start.mode, result.program), range: carriedRange(start.mode, start.range), notice: null, project: NEW_PROJECT };
  }
  console.info(`${start.origin}: invalid text`);
  return fallback(sources, rejection(start.origin, result, null));
}

async function fallback(sources: FirstTextSources, notice: string): Promise<FirstText> {
  const source = await sources.template(sources.fallback);
  return { source, mode: "loop", range: null, notice, project: { id: null, templateOrigin: sources.fallback } };
}

/** The mode and range a project was left in; one stored before them opens in the session's default. */
function projectPlayback(record: ProjectRecord, sources: FirstTextSources): Pick<FirstText, "mode" | "range"> {
  const playback = record.playback;
  if (playback === undefined) return { mode: null, range: null };
  const result = sources.analyze(record.source);
  return { mode: result.ok ? openingMode(playback.mode, result.program) : null, range: carriedRange(playback.mode, playback.range) };
}
