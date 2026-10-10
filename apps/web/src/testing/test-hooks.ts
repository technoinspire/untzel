// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// window.untzelTest, for the browser tests and the measurements. Imported by
// boot.ts only under import.meta.env.MODE === "test": production drops the import, and
// with it this chunk (check-budgets.mjs fails if "untzelTest" or a src/testing chunk
// reaches production). The tests wait for window.untzelTest before they use it.
import type { Engine, EngineStats, LoadMeter, SamplesLoaded } from "@untzel/audio/main";
import type { Session } from "@untzel/session";
import type { LightCue, LightTimeline } from "@untzel/light";
import type { PreviewNoteAudition } from "../adapters/note-audition";
import type { RunningControls } from "../adapters/session-controls-port";
import type { DeviceProbe } from "@untzel/export";
import type { PlayRange } from "../adapters/controls/export/export-request";
import { exportTitleText } from "../adapters/controls/export-sheet/export-title";
import { deviceTraits } from "../page/device-traits";
import type { LightRelay } from "../page/light-relay";

export interface TestHookSources {
  readonly engine: Engine;
  readonly session: Session;
  readonly controls: RunningControls;
  /** What the touched notes asked to sound, as sent to the preview path. */
  readonly audition: PreviewNoteAudition;
  readonly meter: LoadMeter;
  readonly light: LightRelay;
  readonly tappedAt: () => number | null;
  readonly runningAt: () => number | null;
  readonly stats: () => EngineStats | null;
  /** The frame of bar 0 of this play; resetStartFrame forgets it before a new play. */
  readonly startFrame: () => number | null;
  readonly resetStartFrame: () => void;
}

// Over 40 lines: test build only, one literal of window.untzelTest, a hook per entry.
export function installTestHooks(sources: TestHookSources): void {
  const { engine, session, controls, meter } = sources;
  const { context } = engine;
  const rms = createRms(engine);
  const stereo = createStereoMeter(engine);
  const samplesLoaded: SamplesLoaded[] = [];
  engine.sound.onSamplesLoaded((loaded) => samplesLoaded.push(loaded));
  let timeline: LightTimeline = { audioTime: 0, bar: 0, secondsPerBar: 2, section: null };
  engine.sound.onScheduled(({ batch, sampleRate }) => {
    const { position } = batch;
    timeline = { audioTime: position.frame / sampleRate, bar: position.bar, secondsPerBar: position.framesPerBar / sampleRate, section: position.section };
  });
  const hooks = {
    applyText: (text: string) => session.applyText(text),
    stop: () => session.stop(),
    // The drift test in song mode: startFrame is the bar 0 of this play.
    play: (mode: "loop" | "song") => {
      sources.resetStartFrame();
      return session.play(mode);
    },
    stats: sources.stats,
    startFrame: sources.startFrame,
    sampleRate: () => engine.clock.sampleRate,
    contextState: () => context.state,
    calibrated: () => meter.current().calibrated,
    meter: () => meter.current().fraction,
    calibration: () => meter.calibration(),
    outputLatency: () => context.outputLatency ?? context.baseLatency,
    // The output clock against performance.now(): when a context frame leaves the speaker.
    outputTimestamp: () => context.getOutputTimestamp(),
    tappedAt: sources.tappedAt,
    runningAt: sources.runningAt,
    underruns: () => (context as AudioContext & { playbackStats?: { underrunEvents?: number } }).playbackStats?.underrunEvents ?? null,
    rms,
    // Which sample packs reached the worklet, from which frame, and the stereo
    // width of the output (the recorded choir is spread, the formant choir is centred).
    samplesLoaded: () => samplesLoaded.map((loaded) => ({ ...loaded })),
    currentFrame: () => Math.round(engine.clock.seconds() * engine.clock.sampleRate),
    stereo,
    session: () => session.view(),
    // What the touched notes asked to sound, as sent to the preview path.
    auditions: () => sources.audition.events(),
    exportFile: () => controls.exporter.currentFile(),
    exportDetails: () => controls.exporter.currentDetails(),
    exportLab: () => import("./export-lab"),
    // What the video says about the song, for the lab's title check.
    exportTitle: () => exportTitleText(session.view(), "Untitled"),
    // The scene tests: record the light the stage receives, replay it offline.
    recordLight: async () => (await import("./scene-lab")).startRecording(sources.light),
    sceneLab: () => import("./scene-lab"),
    gpuLab: () => import("@untzel/light/testing"),
    // Sets the play range through the real use case; the export sheet follows it.
    exportPlayRange: (range: PlayRange | null) => (range === null ? controls.range.clearPlayRange() : controls.range.setPlayRange(range.startBar, range.endBar, "release")),
    // A device that already passed the probe, so a test can ask for 4K.
    seedDeviceProbe: async (probe: DeviceProbe) => {
      const api = await import("@untzel/export");
      window.localStorage.setItem(api.PROBE_CACHE_KEY, api.serializeProbe(probe, api.deviceKey(deviceTraits())));
    },
    // The top-bar contrast test: cues on top of the music's, the stage at its brightest.
    audioTime: () => engine.clock.seconds(),
    // Partial cues of tracks of the playing program, completed here, on the music's clock.
    scheduleLight: (cues: readonly Partial<LightCue>[]) => sources.light.schedule(cues.map((cue) => lightCue(cue, timeline)), timeline),
  };
  (window as unknown as Record<string, unknown>)["untzelTest"] = hooks;
}

/** RMS of (L + R) ÷ 2 and of (L − R) ÷ 2 over the last 2 048 samples. */
function createStereoMeter(engine: Engine): () => { readonly mid: number; readonly side: number } {
  const splitter = engine.context.createChannelSplitter(2);
  engine.output.connect(splitter);
  const channels = [0, 1].map((channel) => {
    const analyser = engine.context.createAnalyser();
    analyser.fftSize = 2048;
    splitter.connect(analyser, channel);
    return { analyser, samples: new Float32Array(analyser.fftSize) };
  });
  return () => {
    let mid = 0;
    let side = 0;
    for (const { analyser, samples } of channels) analyser.getFloatTimeDomainData(samples);
    const [left, right] = channels.map(({ samples }) => samples);
    for (let index = 0; index < 2048; index += 1) {
      const l = left?.[index] ?? 0;
      const r = right?.[index] ?? 0;
      mid += ((l + r) / 2) ** 2;
      side += ((l - r) / 2) ** 2;
    }
    return { mid: Math.sqrt(mid / 2048), side: Math.sqrt(side / 2048) };
  };
}

/** The output's RMS over the last 2 048 samples. */
function createRms(engine: Engine): () => number {
  const analyser = engine.context.createAnalyser();
  analyser.fftSize = 2048;
  engine.output.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  return () => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.sqrt(sum / samples.length);
  };
}

function lightCue(partial: Partial<LightCue>, timeline: LightTimeline): LightCue {
  const audioTime = partial.audioTime ?? timeline.audioTime;
  const bars = timeline.bar + (audioTime - timeline.audioTime) / timeline.secondsPerBar;
  return {
    track: "",
    duration: 0.2,
    velocity: 1,
    isAccent: true,
    tone: 1,
    toneMotion: null,
    pitches: [],
    tunePosition: null,
    attack: 0.005,
    release: 0.2,
    section: timeline.section,
    ...partial,
    audioTime,
    bar: Math.floor(bars),
    tick: Math.min(95, Math.floor((bars - Math.floor(bars)) * 96)),
  };
}
