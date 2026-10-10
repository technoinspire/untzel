// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Template identity and club range. A
// template is told apart by what it plays: its kick, its kit and its signature sounds
// (./template-kit, ./template-kicks). Its mix must sit in the club range (./club-range):
// the main section (the section with the most tracks, or the loop of a template without
// sections), 16 bars, its long-term spectrum against the club slope and the K-weighted
// share of every family of stems (./template-stems). `pnpm sim --templates` writes the
// renders as WAV for listening; `pnpm sim --timbre` gates all of it.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { analyze } from "@untzel/language";
import { encodeWav } from "@untzel/export/wav";
import { clubBalance, clubShape, clubViolations, type ClubBalance, type ClubShape, CLUB_OCTAVES } from "../measure/club-range";
import { LOOP_BARS } from "../render/golden";
import { longTermSpectrum } from "../measure/ltas";
import { simRegistry } from "../registry";
import { SAMPLE_RATE, runSource } from "../render/run";
import { sectionNames, withLoopSection } from "../render/sections";
import { TEMPLATE_DIR, readTemplateTree } from "./template-tree";
import { kickDistances, type KickDistance } from "./template-kicks";
import { kitOf, reportSignatureViolations, sharedDrumViolations, signatureSources, uniqueSourceViolations, type KitViolation, type TemplateKit } from "./template-kit";
import { stemPowers } from "./template-stems";
import { TEMPLATE_SHARED_DRUMS_MAX, TEMPLATE_SIGNATURES } from "../timbre/timbre-targets";

export interface TemplateRender {
  readonly template: string;
  readonly source: string;
  /** null for a template without sections (its loop is the main part). */
  readonly section: string | null;
  readonly left: Float32Array;
  readonly right: Float32Array;
}
export interface TemplateClub {
  readonly template: string;
  readonly section: string | null;
  readonly shape: ClubShape;
  readonly balance: ClubBalance;
  readonly violations: readonly string[];
}
export interface TemplateIdentity {
  readonly clubs: readonly TemplateClub[];
  readonly kits: readonly (TemplateKit & { readonly signature: readonly string[] })[];
  readonly kitViolations: readonly KitViolation[];
  readonly kicks: readonly KickDistance[];
}

const SECTION_LINE = /^section\s+([a-z][a-z0-9-]*)\s+([^|]*)/;

/** The section with the most tracks (the last of equals: the second drop over the first). */
export function mainSection(source: string): string | null {
  let best: { name: string; tracks: number } | null = null;
  for (const line of source.split("\n")) {
    const match = SECTION_LINE.exec(line);
    if (match === null) continue;
    const tracks = (match[2] ?? "").trim().split(/\s+/).filter((word) => word !== "").length;
    if (best === null || tracks >= best.tracks) best = { name: match[1] ?? "", tracks };
  }
  return best === null || !sectionNames(source).includes(best.name) ? null : best.name;
}

function renderTemplate(name: string, source: string, wasm: WebAssembly.Module): TemplateRender {
  const section = mainSection(source);
  const text = section === null ? source : withLoopSection(source, section);
  const result = runSource(text, { name, mode: "loop", seconds: null, bars: LOOP_BARS, tracks: null, seed: null, wasm, calibration: null, now: () => 0, trackRms: false });
  if (!result.ok || result.run.audio === null) throw new Error(`template ${name} does not render`);
  const from = result.run.startFrame ?? 0;
  return { template: name, source, section, left: result.run.audio.left.subarray(from), right: result.run.audio.right.subarray(from) };
}

/** Every project of the library, by id ("house/disco-lights"); not the starters (blank). */
function projects(repo: string): { readonly name: string; readonly source: string }[] {
  return readTemplateTree(repo).projects.map((project) => ({ name: project.id, source: project.text }));
}

export function renderTemplates(repo: string, wasm: WebAssembly.Module): TemplateRender[] {
  return projects(repo).map((entry) => renderTemplate(entry.name, entry.source, wasm));
}

/** What every project plays (analysis only, no render). */
export function templateKits(repo: string): TemplateKit[] {
  const { registry } = simRegistry();
  return projects(repo).map((entry) => {
    const result = analyze(entry.source, registry);
    if (!result.ok) throw new Error(`template ${entry.name} does not analyze`);
    return kitOf(entry.name, result.program, registry);
  });
}

function mono(render: TemplateRender): Float32Array {
  const out = new Float32Array(render.left.length);
  for (let i = 0; i < out.length; i += 1) out[i] = ((render.left[i] ?? 0) + (render.right[i] ?? 0)) / 2;
  return out;
}

/** The club range of one rendered template (renders its stems). */
export function clubOf(render: TemplateRender, wasm: WebAssembly.Module): TemplateClub {
  const shape = clubShape(longTermSpectrum(mono(render), SAMPLE_RATE));
  const balance = clubBalance(stemPowers(render.template, render.source, render.section, wasm));
  return { template: render.template, section: render.section, shape, balance, violations: clubViolations(render.template, shape, balance) };
}

export function identityOf(clubs: readonly TemplateClub[], kits: readonly TemplateKit[], kicks: readonly KickDistance[]): TemplateIdentity {
  const kitViolations = [...sharedDrumViolations(kits, TEMPLATE_SHARED_DRUMS_MAX), ...uniqueSourceViolations(kits), ...reportSignatureViolations(kits, TEMPLATE_SIGNATURES)];
  return { clubs, kits: kits.map((kit) => ({ ...kit, signature: signatureSources(kit, kits) })), kitViolations, kicks };
}

/** Renders and measures every template: club range, kits and kicks. */
export function measureTemplates(repo: string, wasm: WebAssembly.Module): TemplateIdentity {
  const kits = templateKits(repo);
  return identityOf(renderTemplates(repo, wasm).map((render) => clubOf(render, wasm)), kits, kickDistances(kits, wasm));
}

/** Every identity and club rule that fails, as one line each. */
export function identityFailures(identity: TemplateIdentity): string[] {
  return [
    ...identity.clubs.flatMap((club) => club.violations),
    ...identity.kitViolations.map((violation) => violation.message),
    ...identity.kicks.filter((entry) => !entry.passes).map((entry) => `${entry.a} ~ ${entry.b}: kicks too close (MFCC ${entry.distance.toFixed(2)}, decay alike)`),
  ];
}

const signed = (value: number): string => `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;

function printClub(club: TemplateClub): void {
  const shares = club.balance.familySharesDb.map((entry) => `${entry.family} ${entry.shareDb.toFixed(1)}`).join(" · ");
  const loudest = club.balance.loudest === null ? "–" : `${club.balance.loudest.track} ${club.balance.loudest.shareDb.toFixed(1)}`;
  console.log(
    `  ${club.template.padEnd(30)} tilt ${club.shape.psdTiltDbPerOctave.toFixed(2).padStart(6)} · deviation ${club.shape.deviationDb.toFixed(1).padStart(4)} · Δ ${club.shape.octaveDeltasDb.map(signed).join(" ")}${club.violations.length > 0 ? "  off" : ""}`,
  );
  console.log(`  ${"".padEnd(30)} K-share ${shares} · loudest ${loudest}`);
}

export function printIdentity(identity: TemplateIdentity): void {
  console.log(`templates: club range of the main section, ${LOOP_BARS} bars (PSD tilt 125 Hz..8 kHz; Δ at ${CLUB_OCTAVES.join(", ")} Hz; K-weighted family shares, dB)`);
  for (const club of identity.clubs) printClub(club);
  console.log("templates: kick, kit and signature");
  for (const kit of identity.kits) console.log(`  ${kit.template.padEnd(14)} ${kit.kick ?? "no kick"} · signature ${kit.signature.join(", ") || "none"}`);
  for (const kick of identity.kicks) console.log(`  kick ${`${kick.a} ~ ${kick.b}`.padEnd(28)} ${kick.distance.toFixed(2).padStart(6)}${kick.passes ? "" : "  alike"}`);
  for (const violation of identity.kitViolations) console.log(`  ${violation.message}`);
}

/** --templates: the WAV of every main section into `out`, then the identity. */
export function writeTemplateRenders(repo: string, wasm: WebAssembly.Module, out: string): number {
  mkdirSync(out, { recursive: true });
  const renders = renderTemplates(repo, wasm);
  for (const render of renders) {
    const path = join(out, `${render.template}-${render.section ?? "loop"}.wav`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, encodeWav(render.left, render.right, SAMPLE_RATE));
    console.log(`  ${render.template} (${render.section ?? "loop"}) → ${path}`);
  }
  const kits = templateKits(repo);
  printIdentity(identityOf(renders.map((render) => clubOf(render, wasm)), kits, kickDistances(kits, wasm)));
  console.log(`(templates of ${TEMPLATE_DIR})`);
  return 0;
}
