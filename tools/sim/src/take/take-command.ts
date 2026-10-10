// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm sim --take <take.json> [--from-arm] [--out file.wav]: reads a take, renders it and
// writes the WAV. Exit codes: 0 written, 1 the take does not replay (its code), 2 a file that cannot
// be read or a take the decoder refuses (its code). The music's text is never printed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { decodeTake } from "@untzel/take";
import { TakeReplayError } from "@untzel/take/replay";
import { renderTakeVideoTrack, renderTakeWav, type TakeRenderOptions, type TakeWav } from "./take-render";

export interface TakeRun {
  readonly file: string;
  readonly fromArm: boolean;
  /** The WAV to write. */
  readonly out: string;
}

/** The default WAV of a take, beside the simulator's other outputs: .cache/sim/take-<name>/. */
export function takeOutFile(repo: string, file: string, fromArm: boolean): string {
  const name = basename(file).replace(/(\.take)?\.json$/, "");
  return join(repo, ".cache", "sim", `take-${name}`, fromArm ? "take-from-arm.wav" : "take.wav");
}

export async function runTake(command: TakeRun, options: TakeRenderOptions): Promise<number> {
  let text: string;
  try {
    text = readFileSync(command.file, "utf8");
  } catch {
    console.error(`sim: cannot read ${command.file}`);
    return 2;
  }
  const decoded = decodeTake(text);
  if (!decoded.ok) {
    console.error(`sim: take refused: ${decoded.reason}`);
    return 2;
  }
  let wav: TakeWav;
  try {
    wav = command.fromArm ? renderTakeVideoTrack(decoded.take, options) : await renderTakeWav(decoded.take, options);
  } catch (error) {
    if (!(error instanceof TakeReplayError)) throw error;
    console.error(`sim: take does not replay: ${error.code}`);
    return 1;
  }
  const path = resolve(command.out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, wav.bytes);
  const what = command.fromArm ? "video sound track from the arm" : "WAV from the first sound";
  console.log(`take: ${what}, ${wav.frames} samples (${(wav.frames / 48_000).toFixed(3)} s at 48000 Hz)`);
  console.log(`  → ${path}`);
  return 0;
}
