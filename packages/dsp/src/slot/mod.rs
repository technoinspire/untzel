// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! One instance of an instrument (one track of the text): its voice pool, smoothed
//! parameters, insert chain, fast modulators and lifecycle
//! `Pending → Active → Retiring → Finished`.
//!
//! With an empty insert chain the slot of a mono instrument stays mono and
//! bit-identical to the plain mono path; a stereo instrument (the choir) keeps its two channels, and
//! a wide voice its mid and side, folded to left and right; with effects, the
//! chain turns the voices stereo and the peak, the silence count and the level meter read
//! the chain's output (`voice_output`).
//!
//! Over 300 lines: one slot's lifecycle and render path, which share its pool, parameters and chain on the audio thread.

mod meter;
mod modulation;
mod voice_output;

pub use meter::{Levels, SlotOutput};

use crate::engines::sampler::SamplePack;
use crate::fx::inserts::chain::InsertChain;
use crate::instruments::{INSTRUMENT_NAMES, InstrumentState, parameter_ranges};
use crate::math::SILENCE;
use crate::modulation::Modulators;
use crate::params::{GLIDE, LEGATO, ParamBank};
use voice_output::VoiceOutput;

/// Frames of one render quantum, the largest block `render` accepts.
pub const BLOCK: usize = 128;

/// Glide of a legato note when `glide` is 0.
const LEGATO_GLIDE_SECONDS: f32 = 0.030;

/// Instrument whose slots feed the sidechain (06: from every track of the `kick`
/// instrument).
const SIDECHAIN_SOURCE: &str = "kick";

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
pub enum Lifecycle {
    /// Created, before `activate_at`: takes no events.
    Pending,
    Active,
    /// After `retire_at`: takes no events and finishes its tail.
    Retiring,
    /// Silent after retiring; freed by the next `untzel_collect`.
    Finished,
}

pub struct Slot {
    instrument: InstrumentState,
    instrument_id: usize,
    pub params: ParamBank,
    sample_rate: f32,
    activate_at: f64,
    retire_at: f64,
    finished: bool,
    silent_frames: u32,
    finish_after_frames: u32,
    feeds_sidechain: bool,
    /// Mono (or left) output of the current block, before gain, pan and sends.
    signal: [f32; BLOCK],
    /// The right channel of a stereo instrument.
    voice_output: VoiceOutput,
    /// Peak of `signal` in the current sub-block.
    peak: f32,
    pub active_voices: u32,
    /// Sum of `active_voices × frames` over every render: the load meter's time average.
    pub voice_frames: f64,
    pub onset_count: f64,
    pub last_onset_frame: f64,
    /// Level meter after `gain`, before `pan` and sends (`untzel_slot_levels`).
    levels: Levels,
    /// Test hook: the next render is treated as non-finite (`Engine::poison_slot`).
    poisoned: bool,
    /// Insert chain and its stereo output; on the heap (the chorus lines are large).
    inserts: Box<Inserts>,
    /// Whether the current sub-block went through the chain (stereo output).
    stereo: bool,
    modulators: Modulators,
}

struct Inserts {
    chain: InsertChain,
    left: [f32; BLOCK],
    right: [f32; BLOCK],
}

impl Slot {
    /// None for an unknown instrument id.
    pub fn new(instrument_id: usize, sample_rate: f32, ramp_frames: u32) -> Option<Self> {
        let instrument = InstrumentState::new(instrument_id, sample_rate)?;
        let ranges = parameter_ranges(instrument_id)?;
        let voice_output = VoiceOutput::new(instrument.is_stereo(), sample_rate);
        Some(Slot {
            instrument,
            instrument_id,
            params: ParamBank::new(&ranges, ramp_frames),
            sample_rate,
            activate_at: f64::INFINITY,
            retire_at: f64::INFINITY,
            finished: false,
            silent_frames: 0,
            finish_after_frames: (0.1 * sample_rate) as u32,
            feeds_sidechain: INSTRUMENT_NAMES[instrument_id] == SIDECHAIN_SOURCE,
            signal: [0.0; BLOCK],
            voice_output,
            peak: 0.0,
            active_voices: 0,
            voice_frames: 0.0,
            onset_count: 0.0,
            last_onset_frame: -1.0,
            levels: Levels::default(),
            poisoned: false,
            inserts: Box::new(Inserts {
                chain: InsertChain::new(sample_rate),
                left: [0.0; BLOCK],
                right: [0.0; BLOCK],
            }),
            stereo: false,
            modulators: Modulators::new(),
        })
    }

    pub fn activate(&mut self, at_frame: f64) {
        if at_frame.is_finite() {
            self.activate_at = at_frame;
        }
    }

    pub fn retire(&mut self, at_frame: f64) {
        if at_frame.is_finite() {
            self.retire_at = self.retire_at.min(at_frame);
        }
    }

    pub fn lifecycle(&self, frame: f64) -> Lifecycle {
        if self.finished {
            Lifecycle::Finished
        } else if frame >= self.retire_at {
            Lifecycle::Retiring
        } else if frame >= self.activate_at {
            Lifecycle::Active
        } else {
            Lifecycle::Pending
        }
    }

    pub fn is_finished(&self) -> bool {
        self.finished
    }

    pub fn feeds_sidechain(&self) -> bool {
        self.feeds_sidechain
    }

    /// Starts a voice if the slot takes events at `frame` (the event's frame); the voice
    /// starts at `played_at` (later than `frame` for a late event). Returns whether it did.
    pub fn trigger(
        &mut self,
        frame: f64,
        played_at: f64,
        duration: f64,
        note: f32,
        velocity: f32,
    ) -> bool {
        if self.lifecycle(frame) != Lifecycle::Active || !note.is_finite() {
            return false;
        }
        let duration = duration.clamp(0.0, f64::from(u32::MAX)) as u32;
        let velocity = if velocity.is_finite() {
            velocity.clamp(0.0, 1.0)
        } else {
            0.0
        };
        let legato = self.params.get(LEGATO).start >= 0.5;
        let mut glide = self.params.get(GLIDE).start;
        if legato && glide <= 0.0 {
            glide = LEGATO_GLIDE_SECONDS;
        }
        let glide_frames = (glide * self.sample_rate) as u32;
        self.instrument.trigger(
            note,
            velocity,
            duration,
            glide_frames,
            legato,
            &self.params.voice_params(),
        );
        self.onset_count += 1.0;
        self.last_onset_frame = played_at;
        self.modulators.note_started(played_at);
        true
    }

    /// Renders the voices into `signal[offset..offset + len]` and, with effects, the
    /// chain into the stereo buffers. `frame` is the frame of the first sample. A
    /// non-finite result clears the voices and the chain; returns true then
    /// (`nanResets`).
    pub fn render_voices(&mut self, offset: usize, len: usize, frame: f64) -> bool {
        self.peak = 0.0;
        self.stereo = false;
        if self.finished {
            self.signal[offset..offset + len].fill(0.0);
            self.voice_output.clear();
            return false;
        }
        self.active_voices = self.voice_output.render(
            &mut self.instrument,
            &mut self.signal,
            offset,
            len,
            &self.params.voice_params(),
        );
        let mut peak = self.route(offset, len, frame);
        if self.poisoned {
            self.poisoned = false;
            peak = f32::NAN;
        }
        if peak.is_finite() {
            self.peak = peak;
            self.voice_frames += f64::from(self.active_voices) * len as f64;
            return false;
        }
        self.clear_after_non_finite(offset, len);
        true
    }

    /// Sends the block's voices through the insert chain, or folds a wide voice's mid and
    /// side into left and right; returns the peak of what leaves the slot.
    fn route(&mut self, offset: usize, len: usize, frame: f64) -> f32 {
        let range = offset..offset + len;
        let peak = self.voice_output.peak(&self.signal, offset, len);
        let side_peak = self.voice_output.side_peak();
        let Inserts { chain, left, right } = &mut *self.inserts;
        chain.apply_due(frame);
        if chain.is_active() && (peak > 0.0 || side_peak > 0.0 || chain.has_tail()) {
            self.voice_output.fold_into(&mut self.signal, offset, len);
            let input = &self.signal[range.clone()];
            let side = self.voice_output.side(offset, len);
            let (left, right) = (&mut left[range.clone()], &mut right[range]);
            let chain_peak = chain.process(input, side, left, right, &self.params, frame);
            self.stereo = true;
            // A non-finite input already makes `peak` non-finite.
            return if peak.is_finite() && side_peak.is_finite() {
                chain_peak
            } else {
                f32::NAN
            };
        }
        if let Some(side) = self.voice_output.side(offset, len) {
            self.stereo = true;
            let input = &self.signal[range.clone()];
            let (left, right) = (&mut left[range.clone()], &mut right[range]);
            return voice_output::fold_mid_side(input, side, side_peak, left, right);
        }
        peak
    }

    /// A non-finite block: clears the voices, the chain and the modulators (`nanResets`).
    fn clear_after_non_finite(&mut self, offset: usize, len: usize) {
        self.signal[offset..offset + len].fill(0.0);
        self.voice_output.clear();
        self.inserts.left[offset..offset + len].fill(0.0);
        self.inserts.right[offset..offset + len].fill(0.0);
        self.stereo = false;
        self.instrument.reset();
        self.inserts.chain.reset();
        self.modulators.reset();
        self.active_voices = 0;
    }

    /// Whether the current sub-block carries any signal.
    pub fn is_sounding(&self) -> bool {
        self.peak > 0.0
    }

    /// Mono output of this block so far, before gain, pan and sends (the left channel of
    /// a stereo instrument, the mid signal of a wide voice). With effects this is the dry voice signal; read `output`
    /// instead.
    pub fn signal(&self, offset: usize, len: usize) -> &[f32] {
        &self.signal[offset..offset + len]
    }

    /// What leaves the slot before gain: the chain's stereo output with effects, else
    /// the voices as they are (mono, or stereo for a stereo instrument).
    pub fn output(&self, offset: usize, len: usize) -> SlotOutput<'_> {
        let left = &self.signal[offset..offset + len];
        if self.stereo {
            SlotOutput::Stereo(
                &self.inserts.left[offset..offset + len],
                &self.inserts.right[offset..offset + len],
            )
        } else if let Some(right) = self.voice_output.right(offset, len) {
            SlotOutput::Stereo(left, right)
        } else {
            SlotOutput::Mono(left)
        }
    }

    /// Instrument id the slot was created for.
    pub fn instrument_id(&self) -> usize {
        self.instrument_id
    }

    /// The sample pack the next notes of a sample-based instrument play.
    pub fn use_samples(&mut self, pack: Option<&'static SamplePack>) {
        self.instrument.use_samples(pack);
    }

    /// Ends a sub-block that started at `frame`: advances the ramps and, when retiring,
    /// counts silence until the slot finishes (−90 dBFS for 100 ms).
    pub fn end_sub_block(&mut self, frame: f64, len: usize) {
        let gain = self.params.output_gain();
        self.params.advance(len as u32);
        if self.lifecycle(frame) != Lifecycle::Retiring {
            return;
        }
        let level = self.peak * gain.bound(len);
        if level < SILENCE {
            self.silent_frames = self.silent_frames.saturating_add(len as u32);
        } else {
            self.silent_frames = 0;
        }
        if self.silent_frames >= self.finish_after_frames {
            self.finished = true;
            self.active_voices = 0;
            self.instrument.reset();
        }
    }

    /// CPU protection: at most `max_voices` sound (0 = no cap).
    pub fn set_voice_limit(&mut self, max_voices: usize) {
        self.instrument.set_voice_limit(max_voices);
    }

    /// Test hook for the NaN recovery path.
    pub fn poison(&mut self) {
        self.poisoned = true;
    }

    /// Silences the voices and the chain and settles every ramp (after a stop).
    pub fn reset(&mut self) {
        self.instrument.reset();
        self.inserts.chain.reset();
        self.modulators.reset();
        self.params.settle();
        self.active_voices = 0;
        self.signal = [0.0; BLOCK];
        self.voice_output.clear();
        self.inserts.left = [0.0; BLOCK];
        self.inserts.right = [0.0; BLOCK];
        self.stereo = false;
    }
}
