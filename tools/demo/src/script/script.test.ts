// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { fileURLToPath } from "node:url";
import { analyze, dropEdit, setTrackMuted } from "@untzel/language";
import { simRegistry } from "@untzel/sim/registry";
import { readTemplateTree, templateFiles } from "@untzel/sim/template-tree";
import { describe, expect, it } from "vitest";
import { demoActions, type CodeReason, type DemoAction, type DemoScript } from "../actions";
import { comparableProgram } from "./program-equality";
import { replayActions } from "./replay";
import { buildDemoScript, lineWithoutMute } from "./script";

const { registry } = simRegistry();
const catalog = readTemplateTree(fileURLToPath(new URL("../../../../", import.meta.url)));
const templates = templateFiles(catalog).map((template) => [template.id, template.text] as const);

function scriptOf(source: string): DemoScript {
  const built = buildDemoScript(source, registry);
  if (!built.ok) throw new Error(built.diagnostics.map((diagnostic) => diagnostic.message).join("; "));
  return built.script;
}

/** Replays the script from an empty text and returns both programs, ready to compare. */
function roundTrip(source: string): { readonly built: unknown; readonly template: unknown; readonly text: string } {
  const replayed = replayActions("", demoActions(scriptOf(source)), registry);
  if (!replayed.ok) throw new Error(`replay failed at action ${replayed.failedAt}: ${replayed.reason}`);
  const built = analyze(replayed.source, registry);
  const template = analyze(source, registry);
  if (!built.ok || !template.ok) throw new Error("both texts must play");
  return { built: comparableProgram(built.program), template: comparableProgram(template.program), text: replayed.source };
}

function typedReasons(source: string): CodeReason[] {
  return demoActions(scriptOf(source)).flatMap((action) => (action.kind === "typeCode" ? [action.reason] : []));
}

describe("every template in apps/web/src/templates", () => {
  it("has at least one template to check", () => {
    expect(templates.length).toBeGreaterThan(0);
  });

  it.each(templates)("%s: the replayed script gives the template's program", (_, source) => {
    const { built, template } = roundTrip(source);
    expect(built).toEqual(template);
  });
});

describe("buildDemoScript on Midnight Bloom", () => {
  const source = templateFiles(catalog).find((template) => template.id === "melodic-techno/midnight-bloom")?.text ?? "";
  const script = scriptOf(source);
  it("builds the first track of each family by hand, the band in Code, the Drop, then the arrangement", () => {
    expect(script.layers.map((layer) => [layer.name, layer.role])).toEqual([
      ["setup", "setup"],
      ["kick", "kick"],
      ["sub", "bass"],
      ["hat", "percussion"],
      ["pad", "harmony"],
      ["lead", "melody"],
      ["choir", "voice"],
      ["band", "band"],
      ["breakdown", "breakdown"],
      ["drop", "drop"],
      ["arrangement", "arrangement"],
    ]);
  });
  it("types every other track's whole line in bursts, in producer order, without its mute", () => {
    const band = script.layers.find((layer) => layer.role === "band")?.actions ?? [];
    expect(band.length).toBeGreaterThan(0);
    for (const action of band) {
      expect(action).toMatchObject({ kind: "typeCode", placement: { kind: "appendLine" }, reason: "band", pace: "bursts" });
      if (action.kind === "typeCode") expect(action.text).not.toMatch(/\|\s*mute\s*(\||$)/);
    }
    const named = band.flatMap((action) => (action.kind === "typeCode" ? [action.text.split(":")[0]] : []));
    expect(named).toContain("bass");
    expect(named).not.toContain("kick");
  });
  it("starts the music once the first track is in, types the sections whole and ends in song mode", () => {
    const actions = demoActions(script);
    expect(script.layers[1]?.actions.at(-1)).toEqual({ kind: "togglePlay" });
    expect(actions.filter((action) => action.kind === "togglePlay")).toHaveLength(1);
    expect(actions.some((action) => action.kind === "addSectionMember")).toBe(false);
    const arrangement = script.layers.at(-1)?.actions ?? [];
    const sections = arrangement.filter((action) => action.kind === "typeCode" && action.reason === "section");
    expect(sections).toHaveLength(10);
    expect(sections.every((action) => action.kind === "typeCode" && action.pace === "bursts")).toBe(true);
    expect(arrangement.at(-1)).toEqual({ kind: "setMode", mode: "song" });
  });
  it("draws the featured grids with taps and notes, adds each with its sound, and types only what has no edit", () => {
    const actions = demoActions(script);
    const kinds = new Set(actions.map((action) => action.kind));
    expect(kinds).toContain("toggleStep");
    expect(kinds).toContain("setStepNote");
    expect(actions).toContainEqual({ kind: "addTrack", instrument: "kick", track: "kick", preset: "boom" });
    const typed = typedReasons(source);
    expect(typed.filter((reason) => reason === "global")).toHaveLength(3); // title, tempo, key
    expect(typed.filter((reason) => reason === "song")).toHaveLength(1);
    expect(script.layers[1]?.actions.some((action) => action.kind === "typeCode")).toBe(false); // the kick is drawn
  });
  it("builds the tracks a demo file names instead", () => {
    const built = buildDemoScript(source, registry, { featured: ["bass", "kick"] });
    if (!built.ok) throw new Error("Midnight Bloom must play");
    expect(built.script.layers.slice(1, 4).map((layer) => layer.name)).toEqual(["kick", "bass", "band"]);
  });
  it("is a pure function of the text", () => {
    expect(scriptOf(source)).toEqual(script);
  });
});

describe("what the grid cannot draw is typed, and the program still matches", () => {
  const cases: readonly (readonly [string, string, readonly CodeReason[]])[] = [
    ["globals", "tempo 124\nkey a minor\nswing 0.1\nkick x... x... x... x...\n", ["global", "global", "global"]],
    ["accent", "kick X... x... X... x...\n", ["accent"]],
    ["probability", "hat ..x? ..x. ..x. ..x.\n", ["probability"]],
    ["group", "hat x . [x x] .\n", ["group"]],
    ["sustain", "bass c2 ~ ~ . c2 ~ . .\n", ["sustain"]],
    ["odd step count", "kick x.x x.x\n", ["step-count"]],
    ["mixed step counts", "kick x... x... x... x... / x.x.x.x.\n", ["mixed-step-counts"]],
    ["named values and flags", "bass c2 . . . c2 . . . | reverb sea | delay 1/8 | free\n", ["named-value", "named-value", "flag"]],
  ];

  it.each(cases)("%s", (_, source, reasons) => {
    const { built, template } = roundTrip(source);
    expect(built).toEqual(template);
    expect(typedReasons(source)).toEqual(reasons);
  });

  it("draws several bars by copying the first one", () => {
    const source = "hat ..x. ..x. ..x. ..x. / ..x. ..x. ..x. x.xx\n";
    const kinds = demoActions(scriptOf(source)).map((action) => action.kind);
    expect(kinds).toContain("setTrackBars");
    expect(typedReasons(source)).toEqual([]);
    const { built, template } = roundTrip(source);
    expect(built).toEqual(template);
  });

  it("mutes a muted track last, after it was heard", () => {
    const source = "kick x... x... x... x... | drive 0.5 | mute\n";
    const actions = demoActions(scriptOf(source)).filter((action) => action.kind !== "togglePlay");
    expect(actions.at(-1)).toEqual({ kind: "setMute", track: "kick", muted: true });
    const { built, template } = roundTrip(source);
    expect(built).toEqual(template);
  });

  it("writes a loop length in the arrangement", () => {
    const source = "loop 4\nkick x... x... x... x...\nhat ..x. ..x. ..x. ..x. / ..x. ..x. ..x. ..xx\n";
    const arrangement = scriptOf(source).layers.at(-1);
    expect(arrangement?.actions).toContainEqual({ kind: "setLoopBars", bars: 4 });
    const { built, template } = roundTrip(source);
    expect(built).toEqual(template);
  });
});

describe("a template that does not play", () => {
  it("returns the parser's diagnostics and no script", () => {
    const built = buildDemoScript("kick x... | drive 9\n", registry);
    expect(built.ok).toBe(false);
  });
});

/** The text the script has built just before its action `index`. */
function textBefore(script: DemoScript, index: number): string {
  const replayed = replayActions("", demoActions(script).slice(0, index), registry);
  if (!replayed.ok) throw new Error(`replay failed at action ${replayed.failedAt}: ${replayed.reason}`);
  return replayed.source;
}
function layerOf(script: DemoScript, role: string): readonly DemoAction[] {
  return script.layers.find((layer) => layer.role === role)?.actions ?? [];
}
describe("the Drop", () => {
  const source = templateFiles(catalog).find((template) => template.id === "melodic-techno/midnight-bloom")?.text ?? "";
  const script = scriptOf(source);
  const template = analyze(source, registry);
  const program = template.ok ? template.program : null;
  it("comes after the last track layer and before the arrangement", () => {
    const roles = script.layers.map((layer) => layer.role);
    expect(roles.slice(-3)).toEqual(["breakdown", "drop", "arrangement"]);
    expect(layerOf(script, "drop")[0]).toEqual({ kind: "drop" });
  });
  it("mutes the kick and percussion tracks the template leaves on", () => {
    const left = (program?.tracks ?? []).filter((track) => ["kick", "hat", "shaker", "conga", "rim", "perc", "clap"].includes(track.instrument)).map((track) => track.name);
    expect(layerOf(script, "breakdown")).toEqual(left.map((track) => ({ kind: "setMute", track, muted: true })));
    expect(left).toContain("kick");
  });
  it("moves the template's own mutes after the Drop", () => {
    const text = "kick: kick x... x... x... x...\nhat: hat ..x. ..x. ..x. ..x. | mute\nbass: bass c2 . . . c2 . . . | mute\n";
    const built = scriptOf(text);
    expect(layerOf(built, "breakdown")).toEqual([{ kind: "setMute", track: "kick", muted: true }]);
    expect(layerOf(built, "drop")).toEqual([
      { kind: "drop" },
      { kind: "setMute", track: "bass", muted: true },
      { kind: "setMute", track: "hat", muted: true },
    ]);
    const trackLayers = built.layers.filter((layer) => !["band", "breakdown", "drop", "arrangement"].includes(layer.role));
    expect(trackLayers.flatMap((layer) => layer.actions).some((action) => action.kind === "setMute")).toBe(false);
    const { built: replayed, template: expected } = roundTrip(text);
    expect(replayed).toEqual(expected);
  });
  it.each(templates)("%s: before the Drop there is no section, the mode is loop, and the Drop only takes the mutes away", (_, text) => {
    const built = scriptOf(text);
    const actions = demoActions(built);
    const index = actions.findIndex((action) => action.kind === "drop");
    if (index < 0) return;
    const before = textBefore(built, index);
    const analyzed = analyze(before, registry);
    if (!analyzed.ok) throw new Error("the text before the Drop must play");
    expect(analyzed.program.sections).toEqual([]);
    expect(actions.slice(0, index).some((action) => action.kind === "setMode")).toBe(false);
    const dropped = dropEdit(before);
    const unmuted = analyzed.program.tracks
      .filter((track) => track.muted)
      .reduce((text, track) => {
        const edit = setTrackMuted(text, track.name, false);
        return edit.ok ? edit.source : text;
      }, before);
    expect(dropped.ok && dropped.source).toBe(unmuted);
  });
  it("has no Drop without kick nor percussion", () => {
    const actions = demoActions(scriptOf("bass: bass c2 . . . c2 . . .\npad: pad Cm ~ ~ ~\n"));
    expect(actions.some((action) => action.kind === "drop")).toBe(false);
    expect(actions.some((action) => action.kind === "setMute")).toBe(false);
  });
});

describe("the band", () => {
  const text = "kick: kick x... x... x... x...\nhat: hat ..x. ..x. ..x. ..x.\nclap: clap .... x... .... x... | gain 0.8 | mute\nbass: bass c2 . . . c2 . . .\n";
  it("types a muted band track without its mute, and mutes it after the Drop", () => {
    const built = scriptOf(text);
    expect(layerOf(built, "band")).toEqual([
      { kind: "typeCode", placement: { kind: "appendLine" }, text: "clap: clap .... x... .... x... | gain 0.8", reason: "band", pace: "bursts" },
    ]);
    expect(layerOf(built, "drop")).toContainEqual({ kind: "setMute", track: "clap", muted: true });
    const { built: replayed, template } = roundTrip(text);
    expect(replayed).toEqual(template);
  });
  it("keeps the mute in the line when there is no Drop", () => {
    const source = "bass: bass c2 . . . c2 . . .\nsub: sub c1 . . . . . . . | mute\n";
    expect(layerOf(scriptOf(source), "band")).toEqual([
      { kind: "typeCode", placement: { kind: "appendLine" }, text: "sub: sub c1 . . . . . . . | mute", reason: "band", pace: "bursts" },
    ]);
    const { built, template } = roundTrip(source);
    expect(built).toEqual(template);
  });
  it("takes `| mute` out of a line and nothing else", () => {
    expect(lineWithoutMute("hat: hat ..x. | mute | gain 0.5")).toBe("hat: hat ..x. | gain 0.5");
    expect(lineWithoutMute("hat: hat ..x. | muted 1")).toBe("hat: hat ..x. | muted 1");
  });
});
