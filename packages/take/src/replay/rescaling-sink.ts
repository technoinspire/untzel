// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export is always 48 kHz and a take is at the device's rate. The replay's transport
// runs at the take's rate (frames identical to the live ones) and these sinks carry every
// frame field to the export's rate by Math.round(f × to / from).
import type {
  ActivatedModulator,
  ActivatedTrack,
  EventSink,
  ParameterPoint,
  PlaybackPosition,
  PreviewSink,
  ProgramActivation,
  ScheduledEvent,
} from "@untzel/session";

type Rescale = (frame: number) => number;

/** Moves every frame field of the schedule from `from` Hz to `to` Hz; identity when equal. */
export function rescalingSink(sink: EventSink, from: number, to: number): EventSink {
  if (from === to) return sink;
  const rescale = rescaler(from, to);
  return {
    deliver: (batch) =>
      sink.deliver({
        events: batch.events.map((event) => rescaledEvent(event, rescale)),
        parameters: batch.parameters.map((point) => rescaledPoint(point, rescale)),
        position: rescaledPosition(batch.position, rescale),
      }),
    programChanged: (change) => sink.programChanged(rescaledActivation(change, rescale)),
    tempoChanged: (change) => sink.tempoChanged({ ...change, atFrame: rescale(change.atFrame) }),
    stopped: (atFrame) => sink.stopped(rescale(atFrame)),
    ended: (atFrame) => sink.ended(rescale(atFrame)),
  };
}

/** The audition's frames, the same way. */
export function rescalingPreviewSink(sink: PreviewSink, from: number, to: number): PreviewSink {
  if (from === to) return sink;
  const rescale = rescaler(from, to);
  return {
    previewStarted: (track, atFrame) => sink.previewStarted(rescaledTrack(track, rescale), rescale(atFrame)),
    previewScheduled: (events, points) =>
      sink.previewScheduled(
        events.map((event) => rescaledEvent(event, rescale)),
        points.map((point) => rescaledPoint(point, rescale)),
      ),
    previewEnded: (atFrame) => sink.previewEnded(rescale(atFrame)),
  };
}

function rescaler(from: number, to: number): Rescale {
  return (frame) => Math.round((frame * to) / from);
}

function rescaledEvent(event: ScheduledEvent, rescale: Rescale): ScheduledEvent {
  return { ...event, frame: rescale(event.frame), durationFrames: rescale(event.durationFrames) };
}

function rescaledPoint(point: ParameterPoint, rescale: Rescale): ParameterPoint {
  return { ...point, frame: rescale(point.frame), rampFrames: rescale(point.rampFrames) };
}

function rescaledPosition(position: PlaybackPosition, rescale: Rescale): PlaybackPosition {
  return { ...position, frame: rescale(position.frame), framesPerBar: rescale(position.framesPerBar) };
}

function rescaledActivation(change: ProgramActivation, rescale: Rescale): ProgramActivation {
  return { ...change, atFrame: rescale(change.atFrame), tracks: change.tracks.map((track) => rescaledTrack(track, rescale)) };
}

function rescaledTrack(track: ActivatedTrack, rescale: Rescale): ActivatedTrack {
  return { ...track, modulators: track.modulators.map((modulator) => rescaledModulator(modulator, rescale)) };
}

function rescaledModulator(modulator: ActivatedModulator, rescale: Rescale): ActivatedModulator {
  if (modulator.kind === "envelope") return modulator;
  return { ...modulator, periodFrames: rescale(modulator.periodFrames), originFrame: rescale(modulator.originFrame) };
}
