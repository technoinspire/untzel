// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Sampler voice: a multisample zone map of looped stems (`pack`), read with Hermite
//! interpolation (`reader`). A note starts every zone of the pack that holds it (one per
//! vowel and stereo stem); `vowel` 0..1 blends the vowels with equal power, so a vowel
//! sweep morphs aah into ooh without a drop. Pitch moves inside the zone by the playback
//! rate; a legato note that leaves its zone crossfades into the next zone's loop. The
//! pack is handed in from outside (`set_pack`): the core never owns or allocates samples,
//! and a new pack waits for the next note. The vowel blend (`vowels`) and the brightness
//! tilt (`tilt`) live in their own files.

pub mod pack;
pub mod reader;
pub mod recorded;
pub mod recorded_hit;
pub mod tilt;
pub mod vowels;

pub use pack::{MAX_VOWELS, SamplePack, ZONE_CELLS, Zone};
pub use recorded::Recorded;
pub use recorded_hit::{Hit, RecordedHit};
pub use vowels::vowel_weights;

use crate::engines::env::{Adsr, AdsrTimes};
use crate::engines::{Glide, fast_semitones, limit, played_note, semitones};
use crate::math::{SILENCE, advance_phase, sine};
use reader::ZoneReader;
use tilt::BrightnessTilt;

/// Readers of one note: vowels × stems, plus the ones fading out after a zone change.
pub const MAX_READERS: usize = 8;
/// Frames mixed at a time: the render quantum (longer calls are split).
const MAX_FRAMES: usize = 128;
/// Crossfade of a legato note into another zone.
const ZONE_CHANGE_SECONDS: f32 = 0.04;
const VIBRATO_ONSET_SECONDS: f32 = 0.5;

#[derive(Clone, Copy, Debug)]
pub struct SamplerPatch {
    /// Vibrato depth in semitones (0 = none) and rate in Hz, growing after the attack.
    pub vibrato: f32,
    pub vibrato_hz: f32,
    /// Detune between the left and the right stems at `detune` 1, cents.
    pub stem_detune_cents: f32,
    pub level: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct SamplerControls {
    pub vowel: f32,
    /// Output trim of the named sound, 1 = as recorded.
    pub gain: f32,
    pub brightness: f32,
    pub detune: f32,
    pub times: AdsrTimes,
}

pub struct SamplerCore {
    sample_rate: f32,
    patch: SamplerPatch,
    pack: Option<&'static SamplePack>,
    /// The pack the current note reads.
    playing: Option<&'static SamplePack>,
    readers: [ZoneReader; MAX_READERS],
    vowel_of: [usize; MAX_READERS],
    amp: Adsr,
    glide: Glide,
    /// The note the readers' ratios refer to; glide and vibrato move from it.
    reference: f32,
    vibrato_phase: f32,
    vibrato_onset: f32,
    tilt: BrightnessTilt,
}

impl SamplerCore {
    pub fn new(sample_rate: f32, patch: SamplerPatch) -> Self {
        SamplerCore {
            sample_rate,
            patch,
            pack: None,
            playing: None,
            readers: [ZoneReader::default(); MAX_READERS],
            vowel_of: [0; MAX_READERS],
            amp: Adsr::new(sample_rate),
            glide: Glide::default(),
            reference: 60.0,
            vibrato_phase: 0.0,
            vibrato_onset: 0.0,
            tilt: BrightnessTilt::new(sample_rate),
        }
    }

    /// The pack the next notes play; None leaves the voice to its synthesis engine.
    pub fn set_pack(&mut self, pack: Option<&'static SamplePack>) {
        self.pack = pack;
    }

    pub fn has_pack(&self) -> bool {
        self.pack.is_some()
    }

    pub fn trigger(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        controls: &SamplerControls,
    ) {
        let note = played_note(note);
        self.playing = self.pack;
        self.glide.set(note);
        self.reference = note;
        self.readers.iter_mut().for_each(ZoneReader::stop);
        self.start_zones(note, false, 1.0);
        self.amp.trigger(velocity, duration_frames, controls.times);
        self.vibrato_onset = 0.0;
    }

    pub fn legato(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        glide_frames: u32,
        retrigger: bool,
        controls: &SamplerControls,
    ) {
        let note = played_note(note);
        self.glide.glide_to(note, glide_frames);
        let sounding = |reader: &ZoneReader| reader.is_active() && !reader.is_fading_out();
        if self
            .readers
            .iter()
            .any(|reader| sounding(reader) && !reader.holds(note))
        {
            let frames = (ZONE_CHANGE_SECONDS * self.sample_rate) as u32;
            let leaving: [bool; MAX_READERS] =
                core::array::from_fn(|i| self.readers[i].is_active());
            self.readers
                .iter_mut()
                .filter(|reader| reader.is_active())
                .for_each(|reader| reader.fade_to(0.0, frames));
            self.start_zones(note, true, 0.0);
            for (reader, _) in self
                .readers
                .iter_mut()
                .zip(leaving)
                .filter(|(reader, left)| reader.is_active() && !left)
            {
                reader.fade_to(1.0, frames);
            }
        }
        if retrigger {
            self.amp.trigger(velocity, duration_frames, controls.times);
        } else {
            self.amp.extend(velocity, duration_frames);
        }
    }

    /// Adds the voice into `left` and `right`. Returns false when silent.
    pub fn render_stereo(
        &mut self,
        left: &mut [f32],
        right: &mut [f32],
        controls: &SamplerControls,
    ) -> bool {
        self.render_with(left.len().min(right.len()), controls, |n, l, r| {
            left[n] += l;
            right[n] += r;
        })
    }

    /// Mono: both channels at half level, so a centred stem keeps its level.
    pub fn render_mono(&mut self, out: &mut [f32], controls: &SamplerControls) -> bool {
        self.render_with(out.len(), controls, |n, l, r| out[n] += 0.5 * (l + r))
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

    /// Whether a note is sounding (attack, sustain or release).
    pub fn is_active(&self) -> bool {
        self.amp.is_active()
    }

    /// Silences the voice in place; keeps the pack.
    pub fn reset(&mut self) {
        let (patch, pack) = (self.patch, self.pack);
        *self = SamplerCore::new(self.sample_rate, patch);
        self.pack = pack;
    }

    fn render_with(
        &mut self,
        len: usize,
        controls: &SamplerControls,
        mut write: impl FnMut(usize, f32, f32),
    ) -> bool {
        let Some(pack) = self.playing.filter(|_| self.amp.is_active()) else {
            return false;
        };
        self.amp.set_times(controls.times);
        let weights = vowel_weights(pack.vowels(), controls.vowel);
        let stem_detune = controls.detune.clamp(0.0, 1.0) * self.patch.stem_detune_cents / 100.0;
        for reader in self.readers.iter_mut() {
            reader.detune = semitones(reader.pan * stem_detune);
        }
        let brightness = 2.0 * controls.brightness.clamp(0.0, 1.0);
        for chunk in (0..len).step_by(MAX_FRAMES) {
            let frames = (len - chunk).min(MAX_FRAMES);
            let modulation = self.pitch_modulation(frames);
            let [left, right] = self.mix_readers(pack, &weights, &modulation[..frames]);
            for (n, (&l, &r)) in left.iter().zip(&right).take(frames).enumerate() {
                let gain = self.patch.level * controls.gain * self.amp.tick();
                let [l, r] = self.tilt.apply(l, r, brightness);
                write(chunk + n, limit(l * gain), limit(r * gain));
            }
        }
        self.amp.is_active() || self.amp.level() > SILENCE
    }

    /// The readers summed over one chunk, left and right, weighted by vowel. Reader by
    /// reader: a silent vowel only moves its position.
    fn mix_readers(
        &mut self,
        pack: &SamplePack,
        weights: &[f32; MAX_VOWELS],
        modulation: &[f32],
    ) -> [[f32; MAX_FRAMES]; 2] {
        let mut mix = [[0.0_f32; MAX_FRAMES]; 2];
        for (reader, &vowel) in self.readers.iter_mut().zip(&self.vowel_of) {
            if !reader.is_active() {
                continue;
            }
            let base = reader.ratio * reader.detune;
            let weight = weights[vowel];
            if weight <= 0.0 {
                reader.skip_frames(base, modulation);
                continue;
            }
            let (left_gain, right_gain) = (weight * reader.left, weight * reader.right);
            let [left, right] = &mut mix;
            for ((l, r), &factor) in left.iter_mut().zip(right.iter_mut()).zip(modulation) {
                let x = reader.next(pack.pcm, base * factor);
                *l += x * left_gain;
                *r += x * right_gain;
            }
        }
        mix
    }

    /// Playback-rate factor of each frame from glide and vibrato (1 when both rest).
    fn pitch_modulation(&mut self, frames: usize) -> [f32; MAX_FRAMES] {
        if !self.glide.is_gliding() && self.patch.vibrato <= 0.0 {
            return [fast_semitones(self.glide.note() - self.reference); MAX_FRAMES];
        }
        let vibrato_increment = self.patch.vibrato_hz / self.sample_rate;
        let onset_step = 1.0 / (VIBRATO_ONSET_SECONDS * self.sample_rate);
        let mut modulation = [1.0_f32; MAX_FRAMES];
        for factor in modulation[..frames].iter_mut() {
            let mut offset = self.glide.tick() - self.reference;
            if self.patch.vibrato > 0.0 {
                self.vibrato_phase = advance_phase(self.vibrato_phase, vibrato_increment);
                self.vibrato_onset = (self.vibrato_onset + onset_step).min(1.0);
                offset += self.patch.vibrato * self.vibrato_onset * sine(self.vibrato_phase);
            }
            *factor = fast_semitones(offset);
        }
        modulation
    }

    /// Starts a reader for every zone of the playing pack that holds `note`.
    fn start_zones(&mut self, note: f32, from_loop: bool, gain: f32) {
        let Some(pack) = self.playing else {
            return;
        };
        let rate = pack.sample_rate / self.sample_rate;
        for zone in pack.zones.iter().filter(|zone| zone.contains(note)) {
            let Some(vowel) = pack.vowels().iter().position(|&p| p == zone.position) else {
                continue;
            };
            let Some(free) = self.readers.iter().position(|reader| !reader.is_active()) else {
                return;
            };
            let ratio = semitones(self.reference - zone.root) * rate;
            self.readers[free].start(zone, ratio, from_loop, gain);
            self.vowel_of[free] = vowel;
        }
    }
}
