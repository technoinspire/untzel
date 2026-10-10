// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentRegistry } from "@untzel/core";
import type { Diagnostic } from "@untzel/language";
import type { DemoScript } from "../actions";
import { featuredTracks } from "./featured-layers";
import { inProducerOrder, roleOf } from "./producer-order";
import { ScriptWriter } from "./script-writer";
import { readTemplate, type TemplateModel, type TemplateTrack } from "./template";
import { buildTrackLayer, isMutedInTemplate } from "./track-layer";

// The demo script of a template: a pure function of the .untzel text. It
// starts from an empty text and builds the song the way a producer does: setup, then the
// featured layers by hand (kick, bass, hats and percussion, harmony, melody, voice or FX),
// the rest of the band typed in the Code panel, the Drop, then the arrangement typed and
// played in Song mode. Every text action is a minimal edit of @untzel/language, or typing
// in the Code panel where no edit exists yet, or where the demo goes faster on purpose.

export type DemoScriptResult =
  | { readonly ok: true; readonly script: DemoScript }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

export interface DemoScriptOptions {
  /** The demo file's featured tracks; null picks the first track of each family. */
  readonly featured: readonly string[] | null;
}

function writeSetup(writer: ScriptWriter, template: TemplateModel): void {
  for (const line of template.globalLines) {
    writer.do({ kind: "typeCode", placement: { kind: "appendLine" }, text: line, reason: "global", pace: "keys" });
  }
  writer.closeLayer("setup", "setup");
}

/** The kick and percussion tracks the template leaves on: what the breakdown takes out. */
export function dropTracks(template: TemplateModel): readonly TemplateTrack[] {
  return template.tracks.filter((track) => {
    const role = roleOf(track.manifest);
    return (role === "kick" || role === "percussion") && !isMutedInTemplate(track);
  });
}

/** The featured tracks, built by hand in producer order; the music starts once the first one is in. */
function writeFeatured(writer: ScriptWriter, featured: readonly TemplateTrack[], hasDrop: boolean): void {
  featured.forEach((track, index) => {
    buildTrackLayer(writer, track, hasDrop);
    if (index === 0) writer.do({ kind: "togglePlay" });
    writer.closeLayer(track.track.name, roleOf(track.manifest));
  });
}

/** A track's line as written, without `| mute`: the Drop comes first and would take it away. */
export function lineWithoutMute(statement: string): string {
  return statement
    .split("|")
    .filter((part, index) => index === 0 || part.trim() !== "mute")
    .join("|")
    .trimEnd();
}

/**
 * Every other track, in producer order: its whole line typed in the Code panel, in bursts.
 * Its mute, if the template has one, waits for the Drop like the featured tracks' mutes.
 */
function writeBand(writer: ScriptWriter, template: TemplateModel, featured: readonly TemplateTrack[], hasDrop: boolean): void {
  const others = inProducerOrder(template.tracks, (entry) => entry.manifest).filter((track) => !featured.includes(track));
  for (const track of others) {
    const text = hasDrop ? lineWithoutMute(track.statement) : track.statement;
    writer.do({ kind: "typeCode", placement: { kind: "appendLine" }, text, reason: "band", pace: "bursts" });
  }
  writer.closeLayer("band", "band");
}

/**
 * The Drop: the kick and the percussion go out, two bars are heard
 * without them, and the Drop brings them back. The Drop takes every mute away, so the
 * template's own mutes come after it. Before the arrangement: no section yet, loop mode.
 */
function writeDrop(writer: ScriptWriter, template: TemplateModel): void {
  for (const track of dropTracks(template)) writer.do({ kind: "setMute", track: track.track.name, muted: true });
  writer.closeLayer("breakdown", "breakdown");
  writer.do({ kind: "drop" });
  for (const track of inProducerOrder(template.tracks, (entry) => entry.manifest)) {
    if (isMutedInTemplate(track)) writer.do({ kind: "setMute", track: track.track.name, muted: true });
  }
  writer.closeLayer("drop", "drop");
}

/**
 * Length, then each section and the song line typed whole in the Code panel, in bursts,
 * and Song mode: the Song view shows the parts while the arrangement plays to the end.
 */
function writeArrangement(writer: ScriptWriter, template: TemplateModel): void {
  const { loopBars } = template.program;
  if (loopBars !== null) writer.do({ kind: "setLoopBars", bars: loopBars });
  for (const { section, modifiersText } of template.sections) {
    if (section.tracks.length === 0) continue;
    const text = [`section ${section.name} ${section.tracks.join(" ")}`, modifiersText].filter((part) => part !== "").join(" ");
    writer.do({ kind: "typeCode", placement: { kind: "appendLine" }, text, reason: "section", pace: "bursts" });
  }
  if (template.songLine !== null) {
    writer.do({ kind: "typeCode", placement: { kind: "appendLine" }, text: template.songLine, reason: "song", pace: "bursts" });
    writer.do({ kind: "setMode", mode: "song" });
  }
  writer.closeLayer("arrangement", "arrangement");
}

/**
 * The ordered build of `source`, from an empty text. Fails with the parser's diagnostics
 * when the template does not play.
 */
export function buildDemoScript(source: string, registry: InstrumentRegistry, options: DemoScriptOptions = { featured: null }): DemoScriptResult {
  const read = readTemplate(source, registry);
  if (!read.ok) return read;
  const writer = new ScriptWriter(registry);
  const hasDrop = dropTracks(read.template).length > 0;
  const featured = featuredTracks(read.template.tracks, options.featured);
  writeSetup(writer, read.template);
  writeFeatured(writer, featured, hasDrop);
  writeBand(writer, read.template, featured, hasDrop);
  if (hasDrop) writeDrop(writer, read.template);
  writeArrangement(writer, read.template);
  return { ok: true, script: { layers: writer.layers() } };
}
