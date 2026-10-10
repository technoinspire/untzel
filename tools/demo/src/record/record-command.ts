// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm demo record <demo> --format story|video|4k [--keep-frames]: the test build, the
// ?demo page on the virtual clock, the plan played through the
// interface, the take rendered by pnpm sim --take --from-arm, the cards, the MP4 and its
// checks, all in .cache/demo/<demo>-<format>/ with report.json. Exit codes: 0 recorded and
// every check passed; 1 another program, a gate or a check failed; 2 bad input, or ffmpeg or
// Chrome missing.
import { execFile } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { toNumber } from "@untzel/core";
import { analyze } from "@untzel/language";
import { simRegistry } from "@untzel/sim/registry";
import { buildDemo, type BuiltDemo } from "../demo-build";
import { InputError, resolveDemo } from "../demo-source";
import { isSameProgram } from "../script/program-equality";
import { BrowserSession } from "./browser-session";
import { captureFormat, type CaptureFormat, type CaptureFormatName } from "./video/capture-formats";
import { captureSeconds, isCaptureInRange } from "./capture-length";
import { BRAND_CARD_FRAMES, SAMPLES_PER_VIDEO_FRAME, TITLE_CARD_FRAMES, secondsOfFrames } from "./frame-time";
import { finalFrame, layerFrames } from "./gesture-schedule";
import { findTool, hasLibx264 } from "./video/mux";
import { PacedPage } from "./paced-page";
import { GestureDiverged, performPlan, plannedActions, type PerformedAction } from "./perform-plan";
import { finishVideos, type VideoChecks } from "./video/record-videos";
import { isSampledFrame, type AttributionSample } from "./video/verify-frames";

const run = promisify(execFile);

const DEMO_NAME = /^[a-z0-9-]+$/;

export interface RecordArguments {
  readonly demo: string;
  readonly format: CaptureFormatName;
  readonly keepFrames: boolean;
}

export interface RecordContext {
  readonly repo: string;
  readonly write: (text: string) => void;
}

/** The arguments after `record`; a message for bad ones. */
export function parseRecordArguments(argv: readonly string[]): RecordArguments | string {
  const [demo, ...rest] = argv;
  if (demo === undefined || !DEMO_NAME.test(demo)) return "record needs a demo name of lowercase letters, digits and hyphens";
  const at = rest.indexOf("--format");
  const format = at < 0 ? null : captureFormat(rest[at + 1] ?? "");
  if (format === null) return "record needs --format story|video|4k";
  const known = new Set(["--format", format.name, "--keep-frames"]);
  const unknown = rest.find((word) => !known.has(word));
  if (unknown !== undefined) return `record does not take ${unknown}`;
  return { demo, format: format.name, keepFrames: rest.includes("--keep-frames") };
}

/** What the capture made, for the videos and the report. */
export interface Capture {
  readonly armFrame: number;
  /** Frames from the arm to the take's end: the title card and the interface. */
  readonly frames: number;
  readonly sessionText: string;
  readonly isSameProgram: boolean;
  readonly performed: readonly PerformedAction[];
  readonly attribution: readonly AttributionSample[];
  readonly stageRenderer: string | null;
  readonly takeFile: string;
}

interface Tools {
  readonly ffmpeg: string;
  readonly ffprobe: string;
}

async function requireTools(): Promise<Tools> {
  const ffmpeg = findTool("ffmpeg");
  const ffprobe = findTool("ffprobe");
  if (ffmpeg === null || ffprobe === null) throw new InputError("ffmpeg and ffprobe are needed (brew install ffmpeg); pnpm doctor checks them");
  if (!(await hasLibx264(ffmpeg))) throw new InputError(`${ffmpeg} was built without libx264`);
  return { ffmpeg, ffprobe };
}

/** The test bundle the ?demo page lives in, built as pnpm test:browser builds it. */
async function buildTestBundle(repo: string, context: RecordContext): Promise<void> {
  context.write("demo: building the test bundle (vite build --mode test)\n");
  try {
    await run(join(repo, "apps/web/node_modules/.bin/vite"), ["build", "--mode", "test", "--logLevel", "error"], { cwd: join(repo, "apps/web"), maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    throw new InputError(`the test bundle did not build: ${(error as Error).message}`);
  }
}

async function openSession(repo: string, format: CaptureFormat, framesDirectory: string): Promise<BrowserSession> {
  try {
    return await BrowserSession.open({ repo, format, reducedMotion: false, framesDirectory });
  } catch (error) {
    throw new InputError(`the installed Chrome did not open the demo page: ${(error as Error).message}`);
  }
}

// Over 40 lines: the capture's steps in their order, each one call; a split would cut the
// frame count that ties them together.
async function capture(session: BrowserSession, built: BuiltDemo, isPhone: boolean, directory: string, context: RecordContext): Promise<Capture> {
  const { registry } = simRegistry();
  const plan = plannedActions(built.timeline, registry);
  const end = finalFrame(built.timeline);
  // The first interface frame and one every 10 s; the last one once it is known.
  const attribution: AttributionSample[] = [];
  const sample = async (frame: number): Promise<void> => {
    if (!attribution.some((entry) => entry.frame === frame)) attribution.push({ frame, ...(await session.demo.attribution()) });
  };
  session.onFrame = async (frame) => {
    if (isSampledFrame(frame)) await sample(frame);
  };
  const armFrame = await session.demo.armTake();
  await session.demo.showCard("title", { title: built.program.title, tempo: toNumber(built.program.tempo), key: built.program.key });
  await session.capture();
  await session.advance(TITLE_CARD_FRAMES - 1);
  await session.demo.hideCards();
  const stage = { get frame() { return session.frame; }, advance: (frames?: number) => session.advance(frames), advanceTo: (frame: number) => session.advanceTo(frame), sessionText: () => session.demo.sessionText() };
  const page = new PacedPage(session, { keys: built.typingCharsPerSecond, bursts: built.burstCharsPerSecond });
  const performed = await performPlan(stage, page, plan, { registry, isPhone }, (done) => {
    if (done.index % 25 === 0) context.write(`demo: action ${done.index + 1}/${plan.length} (${done.kind}) at frame ${done.startFrame}\n`);
  });
  await session.advanceTo(Math.max(end, session.frame + 1) - 1);
  session.onFrame = null;
  await sample(session.frame);
  // The take ends where the next frame would begin: frame k of the video is sample k × 1 600.
  await session.advance(1, false);
  const frames = session.frame;
  const sessionText = await session.demo.sessionText();
  const take = await session.demo.finishTake();
  const takeFile = join(directory, "take.json");
  writeFileSync(takeFile, take);
  await session.demo.showCard("brand");
  for (let index = 0; index < BRAND_CARD_FRAMES; index += 1) await session.capture(frames + index);
  await session.flushed();
  const final = analyze(sessionText, registry);
  const same = final.ok && isSameProgram(final.program, built.program);
  return { armFrame, frames, sessionText, isSameProgram: same, performed, attribution, stageRenderer: await session.demo.stageRenderer(), takeFile };
}

/** pnpm sim --take <take.json> --from-arm: the video's whole sound track, from the arm. */
async function renderTake(repo: string, takeFile: string, wav: string): Promise<void> {
  await run(process.execPath, [join(repo, "tools/sim/bin/sim.mjs"), "--take", takeFile, "--from-arm", "--out", wav], { cwd: repo, maxBuffer: 64 * 1024 * 1024 });
}

interface Report {
  readonly ok: boolean;
  readonly [field: string]: unknown;
}

function lateness(performed: readonly PerformedAction[]): { readonly maxLateFrames: number; readonly lateActions: number } {
  const late = performed.map((action) => action.startFrame - action.plannedFrame);
  return { maxLateFrames: Math.max(0, ...late), lateActions: late.filter((frames) => frames > 0).length };
}

function report(args: RecordArguments, built: BuiltDemo, taken: Capture, videos: VideoChecks): Report {
  const seconds = secondsOfFrames(taken.frames);
  const isVideoInRange = args.format === "story" || isCaptureInRange(seconds);
  const ok = taken.isSameProgram && isVideoInRange && videos.ok;
  return {
    ok,
    demo: args.demo,
    format: args.format,
    program: { isSameAsTemplate: taken.isSameProgram, actions: taken.performed.length },
    capture: { frames: taken.frames, seconds, plannedSeconds: captureSeconds(built.timeline), isInRange: isVideoInRange, ...lateness(taken.performed) },
    take: { armFrame: taken.armFrame, samples: taken.frames * SAMPLES_PER_VIDEO_FRAME },
    stageRenderer: taken.stageRenderer,
    reducedMotion: false,
    animationClock: "CSS animations held at rate 0 and seeked per frame by the DevTools Animation domain",
    ...videos.report,
  };
}

// Over 40 lines: the command's steps in their order; each failure has its exit code here.
export async function runRecord(args: RecordArguments, context: RecordContext): Promise<number> {
  const { registry } = simRegistry();
  const built = buildDemo(resolveDemo(context.repo, args.demo), registry);
  if (!built.isSameProgram) {
    context.write("demo: the script does not give the template's program (pnpm demo plan says where)\n");
    return 1;
  }
  const format = captureFormat(args.format);
  if (format === null) throw new InputError(`unknown format ${args.format}`);
  if (args.format !== "story" && !isCaptureInRange(captureSeconds(built.timeline))) {
    context.write(`demo: the plan captures ${captureSeconds(built.timeline).toFixed(1)} s, outside 1:00–3:00\n`);
    return 1;
  }
  const tools = await requireTools();
  await buildTestBundle(context.repo, context);
  const directory = join(context.repo, ".cache/demo", `${args.demo}-${args.format}`);
  rmSync(directory, { recursive: true, force: true });
  const framesDirectory = join(directory, "frames");
  mkdirSync(framesDirectory, { recursive: true });
  const session = await openSession(context.repo, format, framesDirectory);
  let result: Report;
  try {
    const taken = await capture(session, built, args.format === "story", directory, context);
    const wav = join(directory, "take.wav");
    await renderTake(context.repo, taken.takeFile, wav);
    await session.release();
    const videos = await finishVideos({ session, tools, format, demo: args.demo, directory, framesDirectory, capture: taken, title: built.program.title, wav, layerFrames: layerFrames(built.timeline) });
    result = report(args, built, taken, videos);
  } catch (error) {
    if (!(error instanceof GestureDiverged)) throw error;
    context.write(`demo: ${error.message}\n`);
    return 1;
  } finally {
    await session.close();
  }

  writeFileSync(join(directory, "report.json"), `${JSON.stringify(result, null, 2)}\n`);
  if (!args.keepFrames) rmSync(framesDirectory, { recursive: true, force: true });
  context.write(`demo: ${result.ok ? "recorded" : "recorded, but a check failed"} → ${join(directory, "report.json")}\n`);
  return result.ok ? 0 : 1;
}


