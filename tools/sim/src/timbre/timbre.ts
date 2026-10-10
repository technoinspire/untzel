// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Timbre feature extraction, pure. No DOM, no audio I/O, no WASM: every function here
// takes a mono sample buffer (Float32Array) and a sample rate and returns numbers.
// The CLI (--timbre) renders each instrument/preset once and feeds the buffers here.
//
// The features match the timbre study's method:
//   STFT 2048/512 Hann; frames to 40 dB below the loudest; spectral centroid and 85%
//   rolloff by magnitude; spectral flatness 50 Hz..16 kHz; MFCC c1..c13 (40 mel bands,
//   30 Hz..16 kHz, log power in dB, DCT-II, no c0, so level does not enter) with a 40 dB
//   per-frame floor (MFCC40); attack and decay from the amplitude envelope; HNR from the
//   normalized autocorrelation peak 40..1000 Hz. The MFCC distance is the Euclidean
//   distance between the two mean MFCC vectors.
// Over 300 lines: pure feature extractors that share the STFT, the mel bank and the envelope of the method.

export interface SpectralFeatures {
  /** Spectral centroid in Hz, magnitude-weighted, averaged over voiced frames. */
  readonly centroidHz: number;
  /** Frequency below which 85% of the magnitude lies, in Hz, averaged over voiced frames. */
  readonly rolloffHz: number;
  /** Spectral flatness 50 Hz..16 kHz (geometric mean / arithmetic mean of power), 0..1. */
  readonly flatness: number;
}

export interface EnvelopeFeatures {
  /** Seconds from −40 dB of the peak up to −6 dB of the peak (the onset ramp). */
  readonly attackSeconds: number;
  /** Seconds from the peak down to −20 dB of the peak. */
  readonly decaySeconds: number;
}

export interface TimbreFeatures extends SpectralFeatures, EnvelopeFeatures {
  /** Mean MFCC, coefficients c1..c13 (c0 dropped), with a 40 dB per-frame floor. */
  readonly mfcc: readonly number[];
  /** Harmonic-to-noise ratio in dB from the autocorrelation peak, median over frames. */
  readonly harmonicToNoiseDb: number;
}

export interface FeatureOptions {
  readonly sampleRate: number;
  /** STFT window; defaults to 2048. Must be a power of two. */
  readonly fftSize?: number;
  /** STFT hop; defaults to 512. */
  readonly hop?: number;
  /** Number of MFCC coefficients kept, c1..cN; defaults to 13. */
  readonly mfccCount?: number;
  /** Mel filter bank size; defaults to 40. */
  readonly melBands?: number;
}

const DEFAULT_FFT_SIZE = 2048;
const DEFAULT_HOP = 512;
const DEFAULT_MFCC_COUNT = 13;
const DEFAULT_MEL_BANDS = 40;
const MEL_LOW_HZ = 30;
const MEL_HIGH_HZ = 16_000;
const FLATNESS_LOW_HZ = 50;
const FLATNESS_HIGH_HZ = 16_000;
const ROLLOFF_FRACTION = 0.85;
/** Frames quieter than this below the loudest frame do not count toward the spectral means. */
const FRAME_FLOOR_DB = 40;
/** Per-frame mel floor for MFCC40: a band this far below the loudest band is clamped. */
const MFCC_FLOOR_DB = 40;
const HNR_LOW_HZ = 40;
const HNR_HIGH_HZ = 1000;

// ---------------------------------------------------------------------------
// FFT: iterative radix-2 Cooley–Tukey. In-place on real/imag arrays of length n
// (a power of two). Pure; no allocation beyond the bit-reversal.
// ---------------------------------------------------------------------------

/** True when n is a positive power of two. */
export function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/** In-place radix-2 FFT. `real` and `imag` have the same power-of-two length. */
// Over 40 lines: the bit reversal and the butterflies of one in-place radix-2 FFT, in their textbook order.
export function fftInPlace(real: Float64Array, imag: Float64Array): void {
  const n = real.length;
  if (n !== imag.length || !isPowerOfTwo(n)) {
    throw new Error(`fftInPlace needs equal power-of-two lengths, got ${n} and ${imag.length}`);
  }
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; (j & bit) !== 0; bit >>= 1) j &= ~bit;
    j |= bit;
    if (i < j) {
      const tr = real[i]!;
      real[i] = real[j]!;
      real[j] = tr;
      const ti = imag[i]!;
      imag[i] = imag[j]!;
      imag[j] = ti;
    }
  }
  // Butterflies.
  for (let length = 2; length <= n; length <<= 1) {
    const half = length >> 1;
    const step = (-2 * Math.PI) / length;
    for (let start = 0; start < n; start += length) {
      for (let k = 0; k < half; k += 1) {
        const angle = step * k;
        const wr = Math.cos(angle);
        const wi = Math.sin(angle);
        const i0 = start + k;
        const i1 = i0 + half;
        const r1 = real[i1]!;
        const i1v = imag[i1]!;
        const tr = wr * r1 - wi * i1v;
        const ti = wr * i1v + wi * r1;
        real[i1] = real[i0]! - tr;
        imag[i1] = imag[i0]! - ti;
        real[i0] = real[i0]! + tr;
        imag[i0] = imag[i0]! + ti;
      }
    }
  }
}

/** Power spectrum (|X|²) of a real frame of length `fftSize`, bins 0..fftSize/2. */
export function powerSpectrum(frame: Float64Array, fftSize: number): Float64Array {
  const real = new Float64Array(fftSize);
  const imag = new Float64Array(fftSize);
  real.set(frame.subarray(0, fftSize));
  fftInPlace(real, imag);
  const bins = fftSize / 2 + 1;
  const power = new Float64Array(bins);
  for (let bin = 0; bin < bins; bin += 1) {
    const re = real[bin]!;
    const im = imag[bin]!;
    power[bin] = re * re + im * im;
  }
  return power;
}

/** Periodic Hann window of length n. */
export function hannWindow(n: number): Float64Array {
  const window = new Float64Array(n);
  for (let i = 0; i < n; i += 1) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return window;
}

// ---------------------------------------------------------------------------
// Mel filter bank and DCT-II for MFCC.
// ---------------------------------------------------------------------------

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number): number {
  return 700 * (10 ** (mel / 2595) - 1);
}

/** Triangular mel filter bank: `bands` filters over the power-spectrum bins. */
export function melFilterBank(bands: number, fftSize: number, sampleRate: number): Float64Array[] {
  const binCount = fftSize / 2 + 1;
  const lowMel = hzToMel(MEL_LOW_HZ);
  const highMel = hzToMel(Math.min(MEL_HIGH_HZ, sampleRate / 2));
  const points = new Float64Array(bands + 2);
  for (let i = 0; i < points.length; i += 1) {
    const hz = melToHz(lowMel + ((highMel - lowMel) * i) / (bands + 1));
    points[i] = Math.floor((fftSize * hz) / sampleRate);
  }
  const filters: Float64Array[] = [];
  for (let band = 1; band <= bands; band += 1) {
    const filter = new Float64Array(binCount);
    const left = points[band - 1]!;
    const center = points[band]!;
    const right = points[band + 1]!;
    for (let bin = left; bin < center; bin += 1) {
      if (center > left) filter[bin] = (bin - left) / (center - left);
    }
    for (let bin = center; bin < right; bin += 1) {
      if (right > center) filter[bin] = (right - bin) / (right - center);
    }
    filters.push(filter);
  }
  return filters;
}

/** DCT-II of `input`, keeping coefficients c1..c(count), i.e. c0 is dropped. */
export function dctKeep(input: readonly number[], count: number): number[] {
  const n = input.length;
  const output: number[] = [];
  for (let k = 1; k <= count; k += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += input[i]! * Math.cos((Math.PI * k * (i + 0.5)) / n);
    // Orthonormal scaling (c0 omitted, so only the sqrt(2/n) branch is used).
    output.push(sum * Math.sqrt(2 / n));
  }
  return output;
}

// ---------------------------------------------------------------------------
// Frame iteration.
// ---------------------------------------------------------------------------

interface Frame {
  readonly power: Float64Array;
  /** Energy of the windowed frame, for the per-frame floor and HNR gating. */
  readonly energy: number;
}

function frames(samples: Float32Array, fftSize: number, hop: number, window: Float64Array): Frame[] {
  const result: Frame[] = [];
  const windowed = new Float64Array(fftSize);
  for (let start = 0; start + fftSize <= samples.length; start += hop) {
    let energy = 0;
    for (let i = 0; i < fftSize; i += 1) {
      const value = (samples[start + i] ?? 0) * window[i]!;
      windowed[i] = value;
      energy += value * value;
    }
    result.push({ power: powerSpectrum(windowed, fftSize), energy });
  }
  return result;
}

/** The loudest frame energy, for the −40 dB voiced-frame gate. */
function voicedFrames(all: readonly Frame[]): Frame[] {
  let peak = 0;
  for (const frame of all) if (frame.energy > peak) peak = frame.energy;
  if (peak <= 0) return [];
  const floor = peak * 10 ** (-FRAME_FLOOR_DB / 10);
  return all.filter((frame) => frame.energy >= floor);
}

// ---------------------------------------------------------------------------
// Spectral descriptors over a single power spectrum.
// ---------------------------------------------------------------------------

function centroidOf(power: Float64Array, sampleRate: number, fftSize: number): number {
  let weighted = 0;
  let total = 0;
  for (let bin = 0; bin < power.length; bin += 1) {
    const magnitude = Math.sqrt(power[bin]!);
    const hz = (bin * sampleRate) / fftSize;
    weighted += hz * magnitude;
    total += magnitude;
  }
  return total > 0 ? weighted / total : 0;
}

function rolloffOf(power: Float64Array, sampleRate: number, fftSize: number): number {
  let total = 0;
  for (let bin = 0; bin < power.length; bin += 1) total += Math.sqrt(power[bin]!);
  if (total <= 0) return 0;
  const target = total * ROLLOFF_FRACTION;
  let cumulative = 0;
  for (let bin = 0; bin < power.length; bin += 1) {
    cumulative += Math.sqrt(power[bin]!);
    if (cumulative >= target) return (bin * sampleRate) / fftSize;
  }
  return (sampleRate / 2) | 0;
}

function flatnessOf(power: Float64Array, sampleRate: number, fftSize: number): number {
  const low = Math.max(1, Math.floor((FLATNESS_LOW_HZ * fftSize) / sampleRate));
  const high = Math.min(power.length - 1, Math.floor((FLATNESS_HIGH_HZ * fftSize) / sampleRate));
  let logSum = 0;
  let linearSum = 0;
  let count = 0;
  for (let bin = low; bin <= high; bin += 1) {
    const value = power[bin]! + 1e-12;
    logSum += Math.log(value);
    linearSum += value;
    count += 1;
  }
  if (count === 0 || linearSum <= 0) return 0;
  const geometric = Math.exp(logSum / count);
  const arithmetic = linearSum / count;
  return geometric / arithmetic;
}

// ---------------------------------------------------------------------------
// Envelope: attack and decay from a short-window amplitude follower.
// ---------------------------------------------------------------------------

/** RMS amplitude envelope in 5 ms windows. */
export function amplitudeEnvelope(samples: Float32Array, sampleRate: number): Float64Array {
  const windowSamples = Math.max(1, Math.round(0.005 * sampleRate));
  const steps = Math.max(1, Math.floor(samples.length / windowSamples));
  const envelope = new Float64Array(steps);
  for (let step = 0; step < steps; step += 1) {
    let sum = 0;
    const base = step * windowSamples;
    for (let i = 0; i < windowSamples; i += 1) {
      const value = samples[base + i] ?? 0;
      sum += value * value;
    }
    envelope[step] = Math.sqrt(sum / windowSamples);
  }
  return envelope;
}

// Over 40 lines: the peak, the attack and the decay read from one envelope, each scan starting where the last one ended.
function envelopeFeatures(samples: Float32Array, sampleRate: number): EnvelopeFeatures {
  const envelope = amplitudeEnvelope(samples, sampleRate);
  const windowSeconds = Math.max(1, Math.round(0.005 * sampleRate)) / sampleRate;
  let peak = 0;
  let peakIndex = 0;
  for (let i = 0; i < envelope.length; i += 1) {
    if (envelope[i]! > peak) {
      peak = envelope[i]!;
      peakIndex = i;
    }
  }
  if (peak <= 0) return { attackSeconds: 0, decaySeconds: 0 };
  const startThreshold = peak * 10 ** (-40 / 20);
  const attackTop = peak * 10 ** (-6 / 20);
  let startIndex = 0;
  for (let i = 0; i <= peakIndex; i += 1) {
    if (envelope[i]! >= startThreshold) {
      startIndex = i;
      break;
    }
  }
  let attackIndex = peakIndex;
  for (let i = startIndex; i <= peakIndex; i += 1) {
    if (envelope[i]! >= attackTop) {
      attackIndex = i;
      break;
    }
  }
  const decayThreshold = peak * 10 ** (-20 / 20);
  let decayIndex = envelope.length - 1;
  for (let i = peakIndex; i < envelope.length; i += 1) {
    if (envelope[i]! <= decayThreshold) {
      decayIndex = i;
      break;
    }
  }
  return {
    attackSeconds: Math.max(0, (attackIndex - startIndex) * windowSeconds),
    decaySeconds: Math.max(0, (decayIndex - peakIndex) * windowSeconds),
  };
}

// ---------------------------------------------------------------------------
// Harmonic-to-noise ratio from the normalized autocorrelation peak.
// ---------------------------------------------------------------------------

/** Median of the normalized autocorrelation peak (40..1000 Hz) over voiced windows, in dB. */
export function harmonicToNoiseDb(samples: Float32Array, sampleRate: number): number {
  const windowSamples = Math.min(samples.length, Math.round(0.04 * sampleRate));
  if (windowSamples < 64) return 0;
  const minLag = Math.max(1, Math.floor(sampleRate / HNR_HIGH_HZ));
  const maxLag = Math.min(windowSamples - 1, Math.floor(sampleRate / HNR_LOW_HZ));
  const hop = Math.max(1, Math.floor(windowSamples / 2));
  const ratios: number[] = [];
  for (let start = 0; start + windowSamples <= samples.length; start += hop) {
    let zero = 0;
    for (let i = 0; i < windowSamples; i += 1) {
      const value = samples[start + i] ?? 0;
      zero += value * value;
    }
    if (zero <= 1e-9) continue;
    let best = 0;
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      let sum = 0;
      for (let i = 0; i + lag < windowSamples; i += 1) {
        sum += (samples[start + i] ?? 0) * (samples[start + i + lag] ?? 0);
      }
      const normalized = sum / zero;
      if (normalized > best) best = normalized;
    }
    const clamped = Math.min(0.9999, Math.max(0, best));
    const hnr = clamped <= 0 ? 0 : 10 * Math.log10(clamped / (1 - clamped));
    ratios.push(hnr);
  }
  if (ratios.length === 0) return 0;
  ratios.sort((a, b) => a - b);
  const mid = ratios.length >> 1;
  return ratios.length % 2 === 0 ? (ratios[mid - 1]! + ratios[mid]!) / 2 : ratios[mid]!;
}

// ---------------------------------------------------------------------------
// MFCC with a 40 dB per-frame floor (MFCC40).
// ---------------------------------------------------------------------------

/** Mean MFCC (c1..mfccCount) over voiced frames, log mel power in dB with a per-frame floor. */
export function meanMfcc(
  framesList: readonly Frame[],
  filters: readonly Float64Array[],
  mfccCount: number,
): number[] {
  if (framesList.length === 0) return new Array(mfccCount).fill(0);
  const accumulated = new Array(mfccCount).fill(0);
  let used = 0;
  for (const frame of framesList) {
    const melPower = new Array(filters.length);
    let loudest = -Infinity;
    for (let band = 0; band < filters.length; band += 1) {
      const filter = filters[band]!;
      let sum = 0;
      for (let bin = 0; bin < filter.length; bin += 1) sum += filter[bin]! * frame.power[bin]!;
      const db = 10 * Math.log10(sum + 1e-12);
      melPower[band] = db;
      if (db > loudest) loudest = db;
    }
    const floor = loudest - MFCC_FLOOR_DB;
    for (let band = 0; band < melPower.length; band += 1) {
      if (melPower[band] < floor) melPower[band] = floor;
    }
    const coefficients = dctKeep(melPower, mfccCount);
    for (let k = 0; k < mfccCount; k += 1) accumulated[k] += coefficients[k]!;
    used += 1;
  }
  return accumulated.map((value) => value / Math.max(1, used));
}

// ---------------------------------------------------------------------------
// Public: extract every feature from a mono buffer.
// ---------------------------------------------------------------------------

export function extractFeatures(samples: Float32Array, options: FeatureOptions): TimbreFeatures {
  const fftSize = options.fftSize ?? DEFAULT_FFT_SIZE;
  const hop = options.hop ?? DEFAULT_HOP;
  const mfccCount = options.mfccCount ?? DEFAULT_MFCC_COUNT;
  const melBands = options.melBands ?? DEFAULT_MEL_BANDS;
  const sampleRate = options.sampleRate;
  if (!isPowerOfTwo(fftSize)) throw new Error(`fftSize must be a power of two, got ${fftSize}`);

  const window = hannWindow(fftSize);
  const allFrames = frames(samples, fftSize, hop, window);
  const voiced = voicedFrames(allFrames);
  const filters = melFilterBank(melBands, fftSize, sampleRate);

  let centroid = 0;
  let rolloff = 0;
  let flatness = 0;
  for (const frame of voiced) {
    centroid += centroidOf(frame.power, sampleRate, fftSize);
    rolloff += rolloffOf(frame.power, sampleRate, fftSize);
    flatness += flatnessOf(frame.power, sampleRate, fftSize);
  }
  const count = Math.max(1, voiced.length);

  return {
    centroidHz: centroid / count,
    rolloffHz: rolloff / count,
    flatness: flatness / count,
    ...envelopeFeatures(samples, sampleRate),
    harmonicToNoiseDb: harmonicToNoiseDb(samples, sampleRate),
    mfcc: meanMfcc(voiced, filters, mfccCount),
  };
}

// ---------------------------------------------------------------------------
// Distance.
// ---------------------------------------------------------------------------

/** Euclidean distance between two MFCC vectors (same length). */
export function mfccDistance(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) throw new Error(`mfcc vectors differ in length: ${a.length} vs ${b.length}`);
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const delta = a[i]! - b[i]!;
    sum += delta * delta;
  }
  return Math.sqrt(sum);
}

/** Ratio of two envelope times, always >= 1 (the "envelope variant" guard from report (d)). */
export function envelopeRatio(a: number, b: number): number {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return low <= 1e-6 ? (high <= 1e-6 ? 1 : Infinity) : high / low;
}
