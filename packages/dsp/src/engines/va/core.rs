// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The complete virtual analog voice: a detune fan of up to seven oscillators (each
//! with a second, crossfaded and optionally hard-synced wave), a sub oscillator and
//! noise, drive, a 12 dB state-variable (low, band, high) or 24 dB ladder filter with
//! its own attack-decay envelope, amplitude ADSR, glide, pitch scoop and delayed
//! vibrato. With `spread` the fan is stereo: the voice adds its mid signal to `out`
//! and its side signal to `side` (L = mid + side, R = mid − side), through a second
//! filter. With every `VaShape` field neutral the voice is the one before the sound-design controls.
//!
//! Over 300 lines: its unit tests included; one complete voice whose oscillators, filter and envelopes share the per-sample state.

use super::controls::{FilterMode, VaControls, VaPatch, VaShape};
use super::fan::{Fan, FanSample, MAX_OSCILLATORS, pans};
use super::filter::{Filter, FilterSetup};
#[cfg(test)]
use super::oscillator::Wave;
use crate::engines::env::{Adsr, AdsrTimes, AttackDecay, Decay};
use crate::engines::{Glide, fast_exp2, fast_semitones, limit, played_note};
use crate::math::{AdaaClip, SILENCE, advance_phase, filter_gain, midi_to_hz, sine};

/// Pitch scoop of brass: how long it takes to settle.
const SCOOP_SECONDS: f32 = 0.06;
const SCOOP_SEMITONES: f32 = 0.5;
/// Delayed vibrato of strings: starts after this, fades in over the same time.
const VIBRATO_DELAY_SECONDS: f32 = 0.3;
const VIBRATO_HZ: f32 = 5.5;
const VIBRATO_SEMITONES: f32 = 0.25;
/// `drive` 1 pushes the fan this many times harder into the clipper (the fan's peak is
/// about the patch level, so the clipper bites from about 0.3).
const DRIVE_PUSH: f32 = 12.0;

/// What `render_mid_side` computes once per block, outside the per-sample loop.
struct BlockSetup {
    count: usize,
    stereo: bool,
    ratios: [f32; MAX_OSCILLATORS],
    pans: [f32; MAX_OSCILLATORS],
    filter: FilterSetup,
    envelope_octaves: f32,
    tracking_octaves: f32,
}

pub struct VaCore {
    sample_rate: f32,
    patch: VaPatch,
    fan: Fan,
    mid: Filter,
    side: Filter,
    glide: Glide,
    amp: Adsr,
    filter_envelope: AttackDecay,
    scoop: Decay,
    accent: f32,
    velocity: f32,
    tremolo_phase: f32,
    vibrato_phase: f32,
    /// Frames since the note started (the vibrato's delay).
    age: u32,
    /// The drive's anti-aliased clippers: mid, then left and right of a stereo fan.
    clippers: [AdaaClip; 3],
    /// Gain of the low cut, set at the block's first sample and while gliding.
    low_cut_gain: f32,
    /// The note's cutoff card, octaves.
    card_octaves: f32,
}

#[allow(clippy::too_many_arguments)]
impl VaCore {
    pub fn new(sample_rate: f32, patch: VaPatch) -> Self {
        VaCore {
            sample_rate,
            patch,
            fan: Fan::new(),
            mid: Filter::default(),
            side: Filter::default(),
            glide: Glide::default(),
            amp: Adsr::new(sample_rate),
            filter_envelope: AttackDecay::default(),
            scoop: Decay::default(),
            accent: 0.0,
            velocity: 0.0,
            tremolo_phase: 0.0,
            vibrato_phase: 0.0,
            clippers: [AdaaClip::default(); 3],
            age: 0,
            low_cut_gain: 0.0,
            card_octaves: 0.0,
        }
    }

    pub fn trigger(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        controls: &VaControls,
    ) {
        self.glide.set(played_note(note));
        if controls.shape.spread > 0.0 {
            self.fan.scatter_phases();
        }
        self.start(velocity, duration_frames, controls);
    }

    /// Mono legato or glide: the pitch moves, the envelopes keep running unless
    /// `retrigger`.
    pub fn legato(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        glide_frames: u32,
        retrigger: bool,
        controls: &VaControls,
    ) {
        self.glide.glide_to(played_note(note), glide_frames);
        if retrigger {
            self.start(velocity, duration_frames, controls);
        } else {
            self.amp.extend(velocity, duration_frames);
        }
    }

    fn start(&mut self, velocity: f32, duration_frames: u32, controls: &VaControls) {
        let accented = velocity >= 0.95;
        self.accent = if accented { controls.accent } else { 0.0 };
        self.velocity = velocity;
        let decay = controls.times.decay * if accented { 0.6 } else { 1.0 };
        let times = AdsrTimes {
            decay,
            ..controls.times
        };
        self.amp.trigger(velocity, duration_frames, times);
        let shape = controls.shape;
        let filter_decay = shape
            .filter_decay
            .unwrap_or(decay * self.patch.envelope_decay);
        self.filter_envelope
            .trigger(shape.filter_attack, filter_decay, self.sample_rate);
        self.scoop.trigger(1.0, SCOOP_SECONDS, self.sample_rate);
        self.age = 0;
        self.fan.new_note(self.glide.target());
        self.card_octaves = self.fan.cutoff_card_octaves(&self.patch);
    }

    /// The mono voice: adds into `out`; false once silent.
    pub fn render(&mut self, out: &mut [f32], controls: &VaControls) -> bool {
        self.render_mid_side(out, None, controls)
    }

    /// Adds the mid signal into `out` and, when the fan is stereo and `side` is given,
    /// the side signal into `side`; false once silent.
    ///
    /// The per-sample loop stays in one function on purpose: it is the hottest loop of
    /// every VA instrument, and each step is an `#[inline]` method so the compiler keeps
    /// the voice's state in registers across them (`pnpm sim --costs`).
    pub fn render_mid_side(
        &mut self,
        out: &mut [f32],
        mut side: Option<&mut [f32]>,
        controls: &VaControls,
    ) -> bool {
        if !self.amp.is_active() {
            return false;
        }
        self.amp.set_times(controls.times);
        let shape = controls.shape;
        let block = self.block_setup(controls, out.len(), side.is_some());
        let (count, stereo) = (block.count, block.stereo);
        let mut base = midi_to_hz(self.glide.note()) / self.sample_rate;
        for n in 0..out.len() {
            let note = self.glide.tick();
            if self.glide.is_gliding() {
                base = 440.0 * fast_semitones(note - 69.0) / self.sample_rate;
            }
            let increment = base * self.pitch_modulation(&shape);
            let fan = self.fan.sample(
                &self.patch,
                increment,
                &block.ratios[..count],
                &block.pans[..count],
                controls,
                stereo,
            );
            let (mid, side_input) = self.drive(fan, &shape, stereo);
            let envelope = self.filter_envelope.tick(self.sample_rate);
            let octaves = (note - 60.0) * block.tracking_octaves
                + block.envelope_octaves * envelope
                + self.card_octaves;
            let cutoff = (controls.cutoff + controls.cutoff_step * n as f32) * fast_exp2(octaves);
            let g = filter_gain(cutoff, self.sample_rate);
            let filter = &block.filter;
            let filtered = self.mid.process(mid, filter.mode, g, filter);
            let filtered_side = if stereo {
                self.side.process(side_input, filter.side_mode, g, filter)
            } else {
                0.0
            };
            let (filtered, filtered_side) =
                self.cut_lows(filtered, filtered_side, n == 0, increment, shape.low_cut);
            let level = self.amplitude(controls) * filter.gain;
            out[n] += limit(filtered * level);
            if let Some(side) = side.as_deref_mut().filter(|_| stereo) {
                side[n] += limit(filtered_side * level);
            }
        }
        self.amp.is_active() || self.amp.level() > SILENCE
    }

    /// The block's fan, pans and filter settings (`has_side`: the caller takes a side).
    fn block_setup(&mut self, controls: &VaControls, frames: usize, has_side: bool) -> BlockSetup {
        let patch = self.patch;
        let shape = controls.shape;
        let stereo = shape.spread > 0.0 && has_side;
        let count = patch.oscillators.clamp(1, MAX_OSCILLATORS);
        let resonance = (controls.resonance + 0.3 * self.accent).min(1.0);
        let mode = shape.filter.unwrap_or(FilterMode::of(patch.filter));
        BlockSetup {
            count,
            stereo,
            ratios: self.fan.ratios(
                &patch,
                count,
                controls.detune,
                frames,
                stereo,
                self.sample_rate,
            ),
            pans: pans(count, shape.spread, stereo),
            filter: FilterSetup::new(mode, resonance),
            envelope_octaves: patch.envelope_octaves * (controls.contour + self.accent),
            tracking_octaves: patch.key_tracking / 12.0,
        }
    }

    /// The low cut under the fundamental (`low-cut` 0 leaves both channels as they are).
    #[inline]
    fn cut_lows(
        &mut self,
        mid: f32,
        side: f32,
        first: bool,
        increment: f32,
        low_cut: f32,
    ) -> (f32, f32) {
        if low_cut <= 0.0 {
            return (mid, side);
        }
        if first || self.glide.is_gliding() {
            self.low_cut_gain = filter_gain(
                0.9 * low_cut * increment * self.sample_rate,
                self.sample_rate,
            );
        }
        let g = self.low_cut_gain;
        (self.mid.cut_lows(mid, g), self.side.cut_lows(side, g))
    }

    /// The scoop and the delayed vibrato as a pitch ratio (exactly 1 when both are off).
    #[inline]
    fn pitch_modulation(&mut self, shape: &VaShape) -> f32 {
        self.age = self.age.saturating_add(1);
        let scoop = self.scoop.tick();
        if shape.scoop <= 0.0 && shape.vibrato <= 0.0 {
            return 1.0;
        }
        let mut offset = -SCOOP_SEMITONES * shape.scoop * scoop;
        if shape.vibrato > 0.0 {
            let delay = VIBRATO_DELAY_SECONDS * self.sample_rate;
            let fade = ((self.age as f32 - delay) / delay).clamp(0.0, 1.0);
            self.vibrato_phase = advance_phase(self.vibrato_phase, VIBRATO_HZ / self.sample_rate);
            offset += VIBRATO_SEMITONES * shape.vibrato * fade * sine(self.vibrato_phase);
        }
        fast_semitones(offset)
    }

    /// Saturation before the filter, per channel (L and R) for a stereo fan. The small
    /// signal keeps its level (the clipper is divided by its push), so `drive` adds
    /// harmonics and squashes the peaks instead of making the voice louder.
    #[inline]
    fn drive(&mut self, fan: FanSample, shape: &VaShape, stereo: bool) -> (f32, f32) {
        if shape.drive <= 0.0 {
            return (fan.mid, fan.side);
        }
        let push = 1.0 + DRIVE_PUSH * shape.drive;
        let [mid_clip, left_clip, right_clip] = &mut self.clippers;
        if !stereo {
            return (mid_clip.process(fan.mid * push) / push, 0.0);
        }
        let left = left_clip.process((fan.mid + fan.side) * push) / push;
        let right = right_clip.process((fan.mid - fan.side) * push) / push;
        (0.5 * (left + right), 0.5 * (left - right))
    }

    /// Amplitude envelope, gain and tremolo of one sample.
    #[inline]
    fn amplitude(&mut self, controls: &VaControls) -> f32 {
        let mut level = self.amp.tick() * controls.gain;
        if controls.tremolo > 0.0 {
            self.tremolo_phase = advance_phase(self.tremolo_phase, 6.0 / self.sample_rate);
            level *= 1.0 - controls.tremolo.min(1.0) * 0.5 * (1.0 + sine(self.tremolo_phase));
        }
        level
    }

    pub fn steal(&mut self) {
        self.amp.steal();
    }

    pub fn level(&self) -> f32 {
        self.amp.level()
    }

    pub fn is_released(&self) -> bool {
        self.amp.is_released()
    }

    pub fn velocity(&self) -> f32 {
        self.velocity
    }

    pub fn reset(&mut self) {
        let patch = self.patch;
        *self = VaCore::new(self.sample_rate, patch);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn controls(wave: Wave) -> VaControls {
        VaControls {
            cutoff: 20_000.0,
            cutoff_step: 0.0,
            resonance: 0.0,
            detune: 0.0,
            wave,
            width: 0.5,
            times: AdsrTimes {
                attack: 0.001,
                decay: 1.0,
                sustain: 1.0,
                release: 0.1,
            },
            contour: 0.0,
            accent: 0.0,
            tremolo: 0.0,
            gain: 1.0,
            shape: VaShape::NEUTRAL,
        }
    }

    /// Magnitude of the DFT bin nearest `hz`.
    fn magnitude(signal: &[f32], hz: f32, sample_rate: f32) -> f32 {
        let (mut re, mut im) = (0.0_f64, 0.0_f64);
        for (n, &x) in signal.iter().enumerate() {
            let w = 2.0 * core::f64::consts::PI * f64::from(hz) * n as f64 / f64::from(sample_rate);
            re += f64::from(x) * w.cos();
            im -= f64::from(x) * w.sin();
        }
        ((re * re + im * im).sqrt() / signal.len() as f64) as f32
    }

    #[test]
    fn the_band_limited_saw_keeps_aliases_below_minus_40_db() {
        for wave in [Wave::Saw, Wave::Square] {
            let sample_rate = 48_000.0;
            let mut core = VaCore::new(sample_rate, VaPatch::DEFAULT);
            // a 4 kHz-ish note: midi 107.4 is 4 kHz; use b7 (3951 Hz).
            let note = 107.0;
            core.trigger(note, 1.0, 48_000, &controls(wave));
            let mut out = vec![0.0; 9_600];
            core.render(&mut out, &controls(wave));
            let signal = &out[4_800..];
            let f0 = midi_to_hz(note);
            let fundamental = magnitude(signal, f0, sample_rate);
            // Aliases of the 7th..11th harmonics fold below Nyquist away from harmonics.
            for harmonic in 7..12 {
                let alias = (harmonic as f32 * f0) % sample_rate;
                let folded = if alias > sample_rate / 2.0 {
                    sample_rate - alias
                } else {
                    alias
                };
                let ratio = magnitude(signal, folded, sample_rate) / fundamental;
                assert!(
                    20.0 * ratio.log10() < -40.0,
                    "{wave:?} alias of harmonic {harmonic}: {ratio}"
                );
            }
        }
    }

    fn render(shape: VaShape, stereo: bool) -> (Vec<f32>, Vec<f32>) {
        let patch = VaPatch {
            oscillators: 7,
            ..VaPatch::DEFAULT
        };
        let mut core = VaCore::new(48_000.0, patch);
        let controls = VaControls {
            detune: 0.5,
            cutoff: 4_000.0,
            shape,
            ..controls(Wave::Saw)
        };
        core.trigger(48.0, 0.8, 24_000, &controls);
        let (mut mid, mut side) = (vec![0.0; 24_000], vec![0.0; 24_000]);
        for (m, s) in mid.chunks_mut(128).zip(side.chunks_mut(128)) {
            core.render_mid_side(m, if stereo { Some(s) } else { None }, &controls);
        }
        (mid, side)
    }

    #[test]
    fn a_neutral_shape_has_no_side_and_spread_makes_one() {
        let (_, side) = render(VaShape::NEUTRAL, true);
        assert!(side.iter().all(|x| *x == 0.0));
        let (_, side) = render(
            VaShape {
                spread: 1.0,
                ..VaShape::NEUTRAL
            },
            true,
        );
        assert!(side.iter().any(|x| x.abs() > 1e-3));
    }

    #[test]
    fn every_filter_mode_and_the_second_wave_stay_finite() {
        for index in 0..4 {
            let shape = VaShape {
                filter: Some(FilterMode::from_index(index)),
                mix: 0.5,
                sync: 0.7,
                wave2: Wave::Square,
                drive: 0.8,
                filter_attack: 0.05,
                scoop: 0.6,
                vibrato: 1.0,
                low_cut: 1.0,
                spread: 0.8,
                ..VaShape::NEUTRAL
            };
            let (mid, side) = render(shape, true);
            assert!(
                mid.iter()
                    .chain(&side)
                    .all(|x| x.is_finite() && x.abs() <= 4.0)
            );
            assert!(mid.iter().any(|x| x.abs() > 1e-3));
        }
    }
}
