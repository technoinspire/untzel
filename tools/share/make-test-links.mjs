#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm share:links [base URL]
// Writes .cache/links.txt: valid v1 links of about 2 000, 4 000, 8 000, 16 000 and 32 000
// characters, to paste into WhatsApp, Instagram, iMessage and Telegram on real phones and
// find the safe link length. Each link is a valid song
// (the onboard's three instruments) padded with comment lines of seeded pseudo-random
// characters, so the compression cannot shrink it away; comments do not change the sound.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const BASE = process.argv[2] ?? "https://app.untzel.com/";
const TARGETS = [2_000, 4_000, 8_000, 16_000, 32_000];
const INSTRUMENTS = ["kick", "hat", "bass"];
const STEPS = ["x", ".", "X", "."];
const NOTES = ["c1", "eb1", "g1", "bb1", "c2", "."];

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function track(index, next) {
  const instrument = INSTRUMENTS[index % INSTRUMENTS.length];
  const pick = (list) => list[Math.floor(next() * list.length)];
  const steps = Array.from({ length: 16 }, () => (instrument === "bass" ? pick(NOTES) : pick(STEPS)));
  return `t${index + 1}: ${instrument} ${steps.join(" ")} | gain ${(0.2 + next() * 0.6).toFixed(2)}`;
}

async function payload(text) {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return Buffer.from(await new Response(stream).arrayBuffer()).toString("base64url");
}

/** A comment of `length` random printable characters. */
function noise(length, next) {
  return `// ${Array.from({ length }, () => String.fromCharCode(33 + Math.floor(next() * 94))).join("")}`;
}

async function linkOf(comments, seed) {
  const next = random(seed);
  const tracks = Array.from({ length: 6 }, (_, index) => track(index, next));
  const lines = ["tempo 132", "key c minor", ...tracks, ...Array.from({ length: comments }, () => noise(60, next))];
  const url = `${BASE}#v1.${await payload(`${lines.join("\n")}\n`)}`;
  return url;
}

const lines = [];
for (const target of TARGETS) {
  let comments = 0;
  let url = await linkOf(comments, target);
  while (url.length < target) {
    comments += 1;
    url = await linkOf(comments, target);
  }
  lines.push(`# ${url.length} characters, 6 tracks and ${comments} comment lines`, url, "");
}
mkdirSync(join(REPO, ".cache"), { recursive: true });
writeFileSync(join(REPO, ".cache/links.txt"), lines.join("\n"));
console.log(`share:links → .cache/links.txt (${TARGETS.length} links on ${BASE})`);
