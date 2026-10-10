// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Sends decoded sample packs to the worklet in pieces. A whole pack in one
// message stalled the audio thread for 34–36 ms right after Play and on every reload
// (measured 04/10/2026 on Sunday Piano: the piano pack is 7.7 M frames): the structured
// clone and the copy into the DSP ran between two render quanta. Now each pack goes as a
// begin, chunks of CHUNK_FRAMES and a commit, one message at a time: the next piece leaves
// only when the worklet says it took the last one, so the render runs between them. Every
// piece is a copy transferred, not cloned on the audio thread; the page keeps the original
// for the export.
import type { MainToWorkletMessage, SamplePackData } from "../protocol";

/** Frames per chunk: 512 KB of 16-bit PCM, well under a render quantum to copy. */
export const CHUNK_FRAMES = 1 << 18;

export interface PackPort {
  postMessage(message: MainToWorkletMessage, transfer: Transferable[]): void;
}

/** The messages of one pack, in order: begin, chunks, commit. */
export function packMessages(pack: SamplePackData, chunkFrames = CHUNK_FRAMES): { message: MainToWorkletMessage; transfer: Transferable[] }[] {
  const zones = pack.zones.slice();
  const out: { message: MainToWorkletMessage; transfer: Transferable[] }[] = [
    {
      message: { type: "samplePackBegin", instrumentId: pack.instrumentId, frames: pack.pcm.length, sampleRate: pack.sampleRate, zones },
      transfer: [zones.buffer],
    },
  ];
  for (let offset = 0; offset < pack.pcm.length; offset += chunkFrames) {
    const pcm = pack.pcm.slice(offset, offset + chunkFrames);
    out.push({ message: { type: "samplePackChunk", offset, pcm }, transfer: [pcm.buffer] });
  }
  out.push({ message: { type: "samplePackCommit", instrumentId: pack.instrumentId }, transfer: [] });
  return out;
}

export class SamplePackSender {
  readonly #port: PackPort;
  readonly #waiting: SamplePackData[] = [];
  #pieces: { message: MainToWorkletMessage; transfer: Transferable[] }[] = [];
  #inFlight = false;

  constructor(port: PackPort) {
    this.#port = port;
  }

  send(pack: SamplePackData): void {
    this.#waiting.push(pack);
    if (!this.#inFlight) this.#next();
  }

  /** The worklet took the last piece: send the next one. */
  onTaken(): void {
    this.#inFlight = false;
    this.#next();
  }

  #next(): void {
    if (this.#pieces.length === 0) {
      const pack = this.#waiting.shift();
      if (pack === undefined) return;
      this.#pieces = packMessages(pack);
    }
    const piece = this.#pieces.shift();
    if (piece === undefined) return;
    this.#inFlight = true;
    this.#port.postMessage(piece.message, piece.transfer);
  }
}
