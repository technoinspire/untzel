// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The text half of template identity: what
// each template plays, read from its analyzed program, and the rules that need no render.
// At most two drum sounds (instrument + preset) shared by any two templates, at least one
// sound (instrument + preset) no other template plays, and the signature sounds the report
// gives its six templates. A sound, not an instrument: thirteen projects share 44
// instruments, and the gate keeps two presets of one instrument at least 10 apart, so a
// preset of its own is a timbre of its own. Pure:
// programs and manifests in, data out.
import type { InstrumentManifest, InstrumentRegistry, Program } from "@untzel/core";

/** The sounds of one template, as the rules read them. */
export interface TemplateKit {
  readonly template: string;
  /** "<instrument> <preset>" of every track whose instrument is in the drums group. */
  readonly drums: readonly string[];
  /** "<instrument> <preset>" of every track. */
  readonly sources: readonly string[];
  /** The first kick track as a playable line (`kick <preset> | <its sound parameters>`), or null. */
  readonly kick: string | null;
}

export interface KitViolation {
  readonly rule: "shared-drums" | "unique-source" | "report-signature";
  readonly message: string;
}

const KICK = "kick";

/** "<value>" of a constant parameter, or null for a signal. */
function constantOf(parameter: Program["tracks"][number]["parameters"][number]): string | null {
  return parameter.value.kind === "constant" ? String(parameter.value.value) : null;
}

/** The kick line: its preset and the manifest parameters the text writes (not gain or sends). */
function kickLine(program: Program, manifest: InstrumentManifest | undefined): string | null {
  const track = program.tracks.find((entry) => entry.instrument === KICK);
  if (track === undefined || manifest === undefined) return null;
  const own = new Set(manifest.parameters.map((parameter) => parameter.name));
  const written = track.parameters
    .filter((parameter) => parameter.explicit && own.has(parameter.name))
    .flatMap((parameter) => {
      const value = constantOf(parameter);
      return value === null ? [] : [`${parameter.name} ${value}`];
    });
  const preset = track.preset ?? manifest.defaultPreset;
  return [`${KICK} ${preset}`, ...written].join(" | ");
}

export function kitOf(template: string, program: Program, registry: InstrumentRegistry): TemplateKit {
  const drums = new Set<string>();
  const sources = new Set<string>();
  for (const track of program.tracks) {
    const manifest = registry.get(track.instrument);
    const sound = `${track.instrument} ${track.preset ?? manifest?.defaultPreset ?? ""}`;
    sources.add(sound);
    if (manifest?.group === "drums") drums.add(sound);
  }
  return { template, drums: [...drums].sort(), sources: [...sources].sort(), kick: kickLine(program, registry.get(KICK)) };
}

/** Every pair of templates that shares more than `max` drum sounds. */
export function sharedDrumViolations(kits: readonly TemplateKit[], max: number): KitViolation[] {
  const violations: KitViolation[] = [];
  for (let i = 0; i < kits.length; i += 1) {
    for (let j = i + 1; j < kits.length; j += 1) {
      const a = kits[i]!;
      const b = kits[j]!;
      const shared = a.drums.filter((sound) => b.drums.includes(sound));
      if (shared.length > max) {
        violations.push({ rule: "shared-drums", message: `${a.template} ~ ${b.template} share ${shared.length} drum sounds (at most ${max}): ${shared.join(", ")}` });
      }
    }
  }
  return violations;
}

/** Every template whose sounds all appear in some other template too. */
export function uniqueSourceViolations(kits: readonly TemplateKit[]): KitViolation[] {
  return kits.flatMap((kit) => {
    const others = new Set(kits.filter((other) => other !== kit).flatMap((other) => other.sources));
    return kit.sources.some((source) => !others.has(source))
      ? []
      : [{ rule: "unique-source" as const, message: `${kit.template} has no sound that no other template plays` }];
  });
}

/** Whether `kit` plays `wanted`: a sound ("piano felt") or any preset of an instrument ("vox"). */
function plays(kit: TemplateKit, wanted: string): boolean {
  return kit.sources.some((sound) => sound === wanted || sound.startsWith(`${wanted} `));
}

/** Every signature sound that its template no longer plays. */
export function reportSignatureViolations(kits: readonly TemplateKit[], signatures: Readonly<Record<string, readonly string[]>>): KitViolation[] {
  return kits.flatMap((kit) =>
    (signatures[kit.template] ?? [])
      .filter((wanted) => !plays(kit, wanted))
      .map((wanted) => ({ rule: "report-signature" as const, message: `${kit.template} lost its report (e) signature ${wanted}` })),
  );
}

/** The sounds of `kit` that no other template plays (its signature). */
export function signatureSources(kit: TemplateKit, kits: readonly TemplateKit[]): string[] {
  const others = new Set(kits.filter((other) => other !== kit).flatMap((other) => other.sources));
  return kit.sources.filter((source) => !others.has(source));
}
