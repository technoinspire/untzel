// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Long-term average spectrum in third-octave bands, normalised by its total energy so only
// the shape counts (the club range reads it, ./club-range). Pure:
// a mono buffer in, numbers out.
import { fftInPlace, hannWindow } from "../timbre/timbre";

/** ISO third-octave centres from 31.5 Hz to 12.5 kHz. */
export const THIRD_OCTAVE_CENTERS: readonly number[] = [
  31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000,
  10000, 12500,
];

const FFT_SIZE = 8192;
const HOP = 4096;
const EDGE = 2 ** (1 / 6);

/** Mean power spectrum over Hann frames (bins 0..FFT_SIZE/2). */
function meanPower(samples: Float32Array): Float64Array {
  const window = hannWindow(FFT_SIZE);
  const power = new Float64Array(FFT_SIZE / 2 + 1);
  const real = new Float64Array(FFT_SIZE);
  const imag = new Float64Array(FFT_SIZE);
  let frames = 0;
  for (let start = 0; start + FFT_SIZE <= samples.length; start += HOP) {
    for (let i = 0; i < FFT_SIZE; i += 1) {
      real[i] = (samples[start + i] ?? 0) * window[i]!;
      imag[i] = 0;
    }
    fftInPlace(real, imag);
    for (let bin = 0; bin < power.length; bin += 1) power[bin]! += real[bin]! ** 2 + imag[bin]! ** 2;
    frames += 1;
  }
  return power.map((value) => value / Math.max(1, frames));
}

/** Band levels in dB relative to the total energy of the bands (the shape of the mix). */
export function longTermSpectrum(samples: Float32Array, sampleRate: number): number[] {
  const power = meanPower(samples);
  const binHz = sampleRate / FFT_SIZE;
  const bands = THIRD_OCTAVE_CENTERS.map((center) => {
    let sum = 0;
    for (let bin = Math.ceil(center / EDGE / binHz); bin * binHz < center * EDGE && bin < power.length; bin += 1) sum += power[bin]!;
    return sum;
  });
  const total = bands.reduce((sum, value) => sum + value, 0);
  return bands.map((value) => 10 * Math.log10((value + 1e-30) / (total + 1e-30)));
}
