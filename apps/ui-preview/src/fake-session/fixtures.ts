// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentGroup, InstrumentKind } from "@untzel/core";
import type { LibraryEntryView, ParameterView, SectionView, SongPartView, StepView } from "@untzel/presentation/view-model";

// Two data sets for the preview. "phase1" is the kick, hat and bass onboard
// (tools/sim/fixtures/phase1-onboard.untzel). "wireframe" is the 9-track onboard of
// the wireframes, used to compare the screens one to one.


/** Library rows of the wireframes: the line and the sounds of the real manifests. */
const LIBRARY_DETAILS: Readonly<Record<string, { readonly description: string; readonly sounds: readonly string[] }>> = {
  kick: { description: "Kick drum, punchy to deep", sounds: ["punch", "tight", "boom", "hard", "deep"] },
  hat: { description: "Hi-hat, closed to open", sounds: ["closed", "open", "tight", "dusty", "metal"] },
  clap: { description: "Hand clap, tight to roomy", sounds: ["tight", "roomy", "snap"] },
  snare: { description: "Snare drum, snap to brush", sounds: ["snap", "fat", "boom", "brush"] },
  perc: { description: "Tuned hits, blocks and pings", sounds: ["block", "ping", "drop"] },
  rim: { description: "Rim shot and wood click", sounds: ["click", "wood"] },
  bass: { description: "Saw bass with a plucked filter", sounds: ["round", "bright", "dirty", "rolling"] },
  acid: { description: "Squelchy acid line", sounds: ["classic", "squelch", "square", "soft"] },
  lead: { description: "Synth lead, soft to sync", sounds: ["classic", "soft", "sync"] },
  stab: { description: "Short chord stab", sounds: ["classic", "rave", "short"] },
  pad: { description: "Warm pad for long chords", sounds: ["warm", "dark", "bright", "sea"] },
  noise: { description: "Noise for sweeps and rises", sounds: ["white", "pink", "wind"] },
  impact: { description: "Impact for the drop", sounds: ["hit", "deep", "metal"] },
};

function libraryEntry(instrument: string, group: LibraryEntryView["group"], inSong: number): LibraryEntryView {
  const details = LIBRARY_DETAILS[instrument];
  return {
    instrument,
    group,
    inSong,
    description: details?.description ?? instrument,
    model: null,
    sounds: (details?.sounds ?? [instrument]).map((name) => ({ name, description: name })),
    tags: [],
    kind: group === "drums" || group === "fx" ? "drum" : "pitched",
    patterns: [],
    parameters: [],
    range: group === "drums" || group === "fx" ? null : { lowest: 24, highest: 84 },
  };
}

export interface TrackFixture {
  readonly name: string;
  readonly instrument: string;
  readonly group: InstrumentGroup;
  readonly kind: InstrumentKind;
  readonly line: number;
  readonly pattern: string;
  readonly tone: number;
  readonly sound: readonly ParameterView[];
  readonly mix: readonly ParameterView[];
  /** Bars of the pattern, each a copy of `pattern`; 1 when absent. */
  readonly bars?: number;
}

export interface Fixture {
  readonly source: string;
  readonly bpm: number;
  readonly key: string;
  /** Loop length of loop mode (`loop <bars>`). */
  readonly loopBars: number;
  readonly scale: readonly string[];
  readonly tracks: readonly TrackFixture[];
  /** Tracks on in loop mode with the music playing; the next one is queued. */
  readonly loopOn: readonly string[];
  readonly queued: string;
  /** The track the track detail screen opens. */
  readonly detail: string;
  /** Its selected step, as drawn; null selects the first filled step. */
  readonly detailStep: number | null;
  readonly sections: readonly SectionView[];
  readonly parts: readonly SongPartView[];
  readonly library: readonly LibraryEntryView[];
  readonly error: { readonly message: string; readonly word: string; readonly line: number };
  readonly change: { readonly line: number; readonly message: string };
}

const C_MINOR = ["c", "d", "eb", "f", "g", "ab", "bb"];

const p = (name: string, display: string, fraction: number): ParameterView => ({ name, display, fraction, signal: null, toneRole: null });
const signal = (name: string, display: string, fraction: number, from: number, to: number): ParameterView => ({
  name,
  display,
  fraction,
  signal: { from, to },
  toneRole: null,
});

const mix = (gain = "0.80", pan = "center", reverb = "0.00", duck = "0.00"): readonly ParameterView[] => [
  p("gain", gain, Number(gain)),
  p("pan", pan, pan === "center" ? 0.5 : pan.startsWith("left") ? 0.5 - Number(pan.split(" ")[1]) / 200 : 0.5 + Number(pan.split(" ")[1]) / 200),
  p("reverb", reverb, Number(reverb)),
  p("duck", duck, Number(duck)),
];

const PHASE1_SOURCE = `// onboard (phase 1: kick, hat and bass only)
tempo 132
key c minor
kick:  kick  x... x... x... x...          | drive 0.3
hat:   hat   ..x. ..x. ..x. ..xx          | swing 0.12
ride:  hat   x.x. x.x. x.x. x.x.          | open 0.7 | gain 0.4 | pan -0.3
sub:   bass  c1 . . c1 . . c1 .           | cutoff 180
bass:  bass  . c2 . c2 . c2 . eb2         | cutoff sine(8) 300..1400 | pan 0.2
section intro  kick hat sub
section build  kick hat ride sub
section drop   kick hat ride sub bass
section break  hat bass
song intro 8, build 4, drop 16, break 8, build 4, drop 16
`;

const SONG: readonly SongPartView[] = [
  { section: "intro", bars: 8, start: 0 },
  { section: "build", bars: 4, start: 8 },
  { section: "drop", bars: 16, start: 12 },
  { section: "break", bars: 8, start: 28 },
  { section: "build", bars: 4, start: 36 },
  { section: "drop", bars: 16, start: 40 },
];

export const phase1: Fixture = {
  source: PHASE1_SOURCE,
  bpm: 132,
  key: "c minor",
  loopBars: 4,
  scale: C_MINOR,
  tracks: [
    { name: "kick", instrument: "kick", group: "drums", kind: "drum", line: 4, pattern: "x... x... x... x...", tone: 0.4,
      sound: [p("decay", "0.45 s", 0.62), p("drive", "0.30", 0.3), p("pitch", "48 Hz", 0.43), p("click", "0.30", 0.3)], mix: mix() },
    { name: "hat", instrument: "hat", group: "drums", kind: "drum", line: 5, pattern: "..x. ..x. ..x. ..xx", tone: 0.5,
      sound: [p("open", "0.00", 0), p("decay", "0.06 s", 0.52), p("color", "0.50", 0.5)], mix: mix() },
    { name: "ride", instrument: "hat", group: "drums", kind: "drum", line: 6, pattern: "x.x. x.x. x.x. x.x.", tone: 0.7,
      sound: [p("open", "0.70", 0.7), p("decay", "0.06 s", 0.52), p("color", "0.50", 0.5)], mix: mix("0.40", "left 30") },
    { name: "sub", instrument: "bass", group: "bass", kind: "pitched", line: 7, pattern: "c1 . . c1 . . c1 .", tone: 0.2,
      sound: [p("cutoff", "180 Hz", 0.29), p("decay", "0.30 s", 0.52), p("drive", "0.10", 0.1)], mix: mix("0.80", "center", "0.00", "0.60") },
    { name: "bass", instrument: "bass", group: "bass", kind: "pitched", line: 8, pattern: ". c2 . c2 . c2 . eb2", tone: 0.45,
      sound: [signal("cutoff", "sine 8 bars · 300–1400", 0.62, 0.38, 0.69), p("decay", "0.30 s", 0.52), p("drive", "0.10", 0.1)],
      mix: mix("0.80", "right 20", "0.00", "0.60") },
  ],
  loopOn: ["kick", "hat", "sub"],
  queued: "bass",
  detail: "bass",
  detailStep: null,
  sections: [
    { name: "intro", tracks: ["kick", "hat", "sub"] },
    { name: "build", tracks: ["kick", "hat", "ride", "sub"] },
    { name: "drop", tracks: ["kick", "hat", "ride", "sub", "bass"] },
    { name: "break", tracks: ["hat", "bass"] },
  ],
  parts: SONG,
  library: [libraryEntry("kick", "drums", 1), libraryEntry("hat", "drums", 2), libraryEntry("bass", "bass", 2)],
  error: { message: 'Section "drop" uses "bass2", but no track has that name.', word: "bass", line: 11 },
  change: { line: 8, message: "Line 8 changed by the bass track: cutoff became sine(8)." },
};

const WIREFRAME_SOURCE = `// onboard
tempo 132
key c minor

kick:  kick  x... x... x... x...
hat:   hat   ..x. ..x. ..x. ..xx
ride:  hat   x.x. x.x. x.x. x.x. | open 0.7 | gain 0.4
clap:  clap  .... x... .... x...
sub:   bass  c1 . . c1 . . c1 .
bass:  bass  . c2 . c2 . c2 . eb2
acid:  acid  c2 . eb2 c3 . c2 g1 . | cutoff sine(8) 300..2400
pad:   pad   Cm7 ~ ~ ~ / Abmaj7 ~ ~ ~
rise:  noise x~~~ ~~~~ ~~~~ ~~~~

section intro  kick hat sub
section build  kick hat ride clap sub acid rise
section drop   kick hat ride clap sub bass acid pad
section break  pad acid

song intro 8, build 4, drop 16, break 8, build 4, drop 16
`;

const drum = (name: string, instrument: string, line: number, pattern: string, tone: number): TrackFixture => ({
  name, instrument, group: "drums", kind: "drum", line, pattern, tone,
  sound: [p("decay", "0.45 s", 0.5), p("drive", "0.20", 0.2)], mix: mix(),
});

export const wireframe: Fixture = {
  source: WIREFRAME_SOURCE,
  bpm: 132,
  key: "c minor",
  // The wireframes draw a 4-bar loop and a 4-bar pattern; the source text stays the one the
  // code screens draw.
  loopBars: 4,
  scale: C_MINOR,
  tracks: [
    drum("kick", "kick", 5, "x... x... x... x...", 0.4),
    drum("hat", "hat", 6, "..x. ..x. ..x. ..xx", 0.5),
    drum("ride", "hat", 7, "x.x. x.x. x.x. x.x.", 0.7),
    drum("clap", "clap", 8, ".... x... .... x...", 0.3),
    { name: "sub", instrument: "bass", group: "bass", kind: "pitched", line: 9, pattern: "x.....x.....x...", tone: 0.2,
      sound: [p("cutoff", "180 Hz", 0.29)], mix: mix() },
    { name: "bass", instrument: "bass", group: "bass", kind: "pitched", line: 10, pattern: "..x...x...x...x.", tone: 0.45,
      sound: [p("cutoff", "600 Hz", 0.5)], mix: mix() },
    { name: "acid", instrument: "acid", group: "bass", kind: "pitched", line: 11, pattern: "c2 . eb2 c3 . c2 g1 .", tone: 0.6,
      sound: [signal("cutoff", "sine 8 bars · 300–2400", 0.62, 0.1, 0.8), p("resonance", "0.70", 0.7), p("accent", "0.50", 0.5), p("slide", "0.20", 0.2), p("wave", "saw", 0)],
      mix: mix("0.80", "center", "0.15", "0.00"), bars: 4 },
    { name: "pad", instrument: "pad", group: "pads", kind: "chord", line: 12, pattern: "x~~~~~~~~~~~~~~~", tone: 0.5,
      sound: [p("attack", "0.40 s", 0.4)], mix: mix() },
    { name: "rise", instrument: "noise", group: "fx", kind: "drum", line: 13, pattern: "x~~~~~~~~~~~~~~~", tone: 0.5,
      sound: [p("cutoff", "2000 Hz", 0.6)], mix: mix() },
  ],
  loopOn: ["kick", "hat", "sub"],
  queued: "acid",
  detail: "acid",
  // The mobile compose and desktop track wireframes select step 3 (eb2).
  detailStep: 2,
  sections: [
    { name: "intro", tracks: ["kick", "hat", "sub"] },
    { name: "build", tracks: ["kick", "hat", "ride", "clap", "sub", "acid", "rise"] },
    { name: "drop", tracks: ["kick", "hat", "ride", "clap", "sub", "bass", "acid", "pad"] },
    { name: "break", tracks: ["pad", "acid"] },
  ],
  parts: SONG,
  library: [
    ...["kick", "hat", "clap", "snare", "perc", "rim"].map((instrument) => libraryEntry(instrument, "drums", ({ kick: 1, hat: 2, clap: 1 } as Record<string, number>)[instrument] ?? 0)),
    libraryEntry("bass", "bass", 2),
    libraryEntry("acid", "bass", 1),
    libraryEntry("lead", "leads", 0),
    libraryEntry("stab", "brass", 0),
    libraryEntry("pad", "pads", 1),
    libraryEntry("noise", "fx", 1),
    libraryEntry("impact", "fx", 0),
  ],
  error: { message: 'Section "drop" uses "acid2", but no track has that name.', word: "acid", line: 17 },
  change: { line: 11, message: "Line 11 changed by the acid track: cutoff became sine(8)." },
};

/** Parses one pattern into the steps of one bar, the way the tile reads it. */
export function stepsOf(pattern: string): StepView[] {
  const tokens = pattern.split(/\s+/).filter((token) => token !== "" && token !== "/");
  const isHits = tokens.every((token) => /^[xX.~]+$/.test(token));
  if (isHits) {
    return [...tokens.join("")].map((char) =>
      char === "x" ? { kind: "hit", label: null } : char === "X" ? { kind: "accent", label: null } : char === "~" ? { kind: "hold", label: null } : { kind: "rest", label: null });
  }
  return tokens.map((token) =>
    token === "." ? { kind: "rest", label: null } : token === "~" ? { kind: "hold", label: null } : /^[A-G]/.test(token) ? { kind: "chord", label: token } : { kind: "note", label: token });
}

/** ?stress=<n>: the fixture's tracks repeated (kick, kick2, …) until there are n. */
export function stressed(fixture: Fixture, count: number): Fixture {
  const tracks: TrackFixture[] = [];
  for (let index = 0; index < count; index += 1) {
    const original = fixture.tracks[index % fixture.tracks.length];
    if (original === undefined) break;
    const round = Math.floor(index / fixture.tracks.length);
    const name = round === 0 ? original.name : `${original.name}${round + 1}`;
    tracks.push({ ...original, name, line: original.line + index });
  }
  return { ...fixture, tracks, loopOn: tracks.map((track) => track.name), queued: "" };
}
