// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Fixed voice pool of one slot: `N` voices from the manifest, allocated on the heap
//! once in the message handler. The allocation policy comes from the manifest:
//! - `Oldest` (kick, hat and bass): a free voice, else the oldest;
//! - `ReleasedQuietest`: the voice already playing the same note, a free one, the
//!   quietest released one, else the oldest;
//! - `mono`: one voice that glides and plays legato.
//!
//! A voice limit (`untzel_voice_limit`, the CPU protection) caps how many voices may
//! sound; voices above the cap fade out with `Voice::steal`. Nothing here allocates
//! after `new`.
//!
//! Over 300 lines: its unit tests included; the allocation policies and the voice limit share one fixed array of voices.

use crate::engines::sampler::SamplePack;
use crate::voice::{Params, Voice};

/// What the pool takes when a new note needs a voice.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Steal {
    Oldest,
    ReleasedQuietest,
}

/// Manifest fields `allocation` and `steal`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct Policy {
    pub mono: bool,
    pub steal: Steal,
}

impl Policy {
    pub const PHASE_1: Policy = Policy {
        mono: false,
        steal: Steal::Oldest,
    };
}

/// A mono voice that ended at most this many frames ago still glides into the next note.
pub const LEGATO_GRACE_FRAMES: u32 = 64;

pub struct Pool<V: Voice, const N: usize> {
    voices: Box<[V]>,
    active: [bool; N],
    /// Trigger order of each voice; the smallest is the oldest.
    started: [u64; N],
    notes: [f32; N],
    /// Taken away by the voice limit: still fading out, no longer counted.
    fading: [bool; N],
    triggers: u64,
    sample_rate: f32,
    policy: Policy,
    /// At most this many voices sound (1..=N).
    limit: usize,
    /// Mono only: frames since the voice was released or went silent.
    released_frames: u32,
}

impl<V: Voice, const N: usize> Pool<V, N> {
    /// Builds the voices one by one on the heap: no temporary of the whole pool crosses
    /// the stack. Message handler only.
    pub fn new(sample_rate: f32, policy: Policy) -> Self {
        let mut voices = Vec::with_capacity(N);
        for _ in 0..N {
            voices.push(V::new(sample_rate));
        }
        Pool {
            voices: voices.into_boxed_slice(),
            active: [false; N],
            started: [0; N],
            notes: [0.0; N],
            fading: [false; N],
            triggers: 0,
            sample_rate,
            policy,
            limit: N,
            released_frames: u32::MAX,
        }
    }

    /// Starts a note. `glide_frames` and `legato` only matter to a mono pool.
    pub fn trigger(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        glide_frames: u32,
        legato: bool,
        params: &Params,
    ) {
        if N == 0 {
            return;
        }
        if self.policy.mono {
            self.trigger_mono(
                note,
                velocity,
                duration_frames,
                glide_frames,
                legato,
                params,
            );
            return;
        }
        let index = match self.policy.steal {
            Steal::Oldest => self.free_or_oldest(),
            Steal::ReleasedQuietest => self.released_quietest(note),
        };
        self.start(index, note);
        self.voices[index].trigger(note, velocity, duration_frames, params);
    }

    /// Adds every active voice into `out` (mono); returns how many are still sounding.
    pub fn render(&mut self, out: &mut [f32], params: &Params) -> u32 {
        let mut side = [0.0_f32; crate::slot::BLOCK];
        let len = out.len().min(side.len());
        self.render_mid_side(&mut out[..len], &mut side[..len], params)
    }

    /// Adds every active voice's mid signal into `out` and side signal into `side`;
    /// returns how many are still sounding.
    pub fn render_mid_side(&mut self, out: &mut [f32], side: &mut [f32], params: &Params) -> u32 {
        let mut sounding = 0;
        for (voice, active) in self.voices.iter_mut().zip(self.active.iter_mut()) {
            if *active {
                *active = voice.render_mid_side(out, side, params);
                sounding += u32::from(*active);
            }
        }
        self.count_release(out.len());
        sounding
    }

    /// `render` for a stereo instrument (`Voice::STEREO`).
    pub fn render_stereo(&mut self, left: &mut [f32], right: &mut [f32], params: &Params) -> u32 {
        let mut sounding = 0;
        for (voice, active) in self.voices.iter_mut().zip(self.active.iter_mut()) {
            if *active {
                *active = voice.render_stereo(left, right, params);
                sounding += u32::from(*active);
            }
        }
        self.count_release(left.len());
        sounding
    }

    pub fn is_stereo(&self) -> bool {
        V::STEREO
    }

    /// Hands every voice the pack its next notes play (no allocation).
    pub fn use_samples(&mut self, pack: Option<&'static SamplePack>) {
        for voice in self.voices.iter_mut() {
            voice.use_samples(pack);
        }
    }

    /// Mono pools: frames since the voice let go, for the legato grace.
    fn count_release(&mut self, frames: usize) {
        if self.policy.mono {
            let holding = self.active[0] && !self.voices[0].is_released();
            self.released_frames = if holding {
                0
            } else {
                self.released_frames.saturating_add(frames as u32)
            };
        }
    }

    /// Silences every voice in place (no allocation: this runs on the audio thread).
    pub fn reset(&mut self) {
        for voice in self.voices.iter_mut() {
            voice.reset(self.sample_rate);
        }
        self.active = [false; N];
        self.fading = [false; N];
        self.released_frames = u32::MAX;
    }

    /// Caps the sounding voices at `max_voices` (0 = no cap). Voices above the cap
    /// fade out, quietest first.
    pub fn set_limit(&mut self, max_voices: usize) {
        self.limit = if max_voices == 0 {
            N
        } else {
            max_voices.min(N)
        };
        while self.active_count() > self.limit {
            let Some(index) = self.quietest_counted() else {
                break;
            };
            self.voices[index].steal();
            self.fading[index] = true;
        }
    }

    pub fn limit(&self) -> usize {
        self.limit
    }

    /// Voices that count against the limit: active and not fading out.
    pub fn active_count(&self) -> usize {
        (0..N)
            .filter(|&i| self.active[i] && !self.fading[i])
            .count()
    }

    fn start(&mut self, index: usize, note: f32) {
        self.triggers += 1;
        self.started[index] = self.triggers;
        self.notes[index] = note;
        self.active[index] = true;
        self.fading[index] = false;
    }

    fn trigger_mono(
        &mut self,
        note: f32,
        velocity: f32,
        duration_frames: u32,
        glide_frames: u32,
        legato: bool,
        params: &Params,
    ) {
        let holding = self.active[0] && self.released_frames <= LEGATO_GRACE_FRAMES;
        self.start(0, note);
        self.released_frames = 0;
        let voice = &mut self.voices[0];
        if holding && (legato || glide_frames > 0) {
            voice.legato(
                note,
                velocity,
                duration_frames,
                glide_frames,
                !legato,
                params,
            );
        } else {
            voice.trigger(note, velocity, duration_frames, params);
        }
    }

    /// The first rule, exactly: the first free voice, else the oldest.
    fn free_or_oldest(&self) -> usize {
        if self.active_count() < self.limit
            && let Some(free) = self.active.iter().position(|active| !active)
        {
            return free;
        }
        self.oldest_active()
    }

    fn released_quietest(&self, note: f32) -> usize {
        if let Some(same) =
            (0..N).find(|&i| self.active[i] && !self.fading[i] && self.notes[i] == note)
        {
            return same;
        }
        if self.active_count() < self.limit
            && let Some(free) = self.active.iter().position(|active| !active)
        {
            return free;
        }
        let released = (0..N)
            .filter(|&i| self.active[i] && !self.fading[i] && self.voices[i].is_released())
            .min_by(|&a, &b| self.voices[a].level().total_cmp(&self.voices[b].level()));
        released.unwrap_or_else(|| self.oldest_active())
    }

    fn oldest_active(&self) -> usize {
        (0..N)
            .filter(|&i| self.active[i] && !self.fading[i])
            .min_by_key(|&i| self.started[i])
            .unwrap_or(0)
    }

    fn quietest_counted(&self) -> Option<usize> {
        (0..N)
            .filter(|&i| self.active[i] && !self.fading[i])
            .min_by(|&a, &b| self.voices[a].level().total_cmp(&self.voices[b].level()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Records its trigger note and stays active until rendered `life` times.
    struct Probe {
        note: f32,
        life: u32,
        released_at: u32,
        stolen: bool,
        legato: bool,
    }

    impl Voice for Probe {
        fn new(_: f32) -> Self {
            Probe {
                note: 0.0,
                life: 0,
                released_at: 0,
                stolen: false,
                legato: false,
            }
        }
        fn trigger(&mut self, note: f32, _: f32, duration_frames: u32, _: &Params) {
            self.note = note;
            self.life = duration_frames;
            self.released_at = duration_frames / 2;
            self.stolen = false;
            self.legato = false;
        }
        fn legato(
            &mut self,
            note: f32,
            _: f32,
            duration: u32,
            _: u32,
            retrigger: bool,
            _: &Params,
        ) {
            self.note = note;
            self.life = duration;
            self.legato = !retrigger;
        }
        fn render(&mut self, out: &mut [f32], _: &Params) -> bool {
            out[0] += self.note;
            self.life = self.life.saturating_sub(1);
            self.life > 0
        }
        fn steal(&mut self) {
            self.stolen = true;
            self.life = self.life.min(1);
        }
        fn level(&self) -> f32 {
            self.life as f32
        }
        fn is_released(&self) -> bool {
            self.life <= self.released_at
        }
        fn reset(&mut self, _: f32) {
            self.life = 0;
        }
    }

    fn params() -> Params<'static> {
        Params {
            start: &[],
            step: &[],
        }
    }

    const POLY: Policy = Policy {
        mono: false,
        steal: Steal::ReleasedQuietest,
    };

    #[test]
    fn a_full_pool_steals_the_oldest_voice() {
        let mut pool: Pool<Probe, 2> = Pool::new(48_000.0, Policy::PHASE_1);
        pool.trigger(1.0, 1.0, 10, 0, false, &params());
        pool.trigger(2.0, 1.0, 10, 0, false, &params());
        pool.trigger(3.0, 1.0, 10, 0, false, &params());
        let mut out = [0.0];
        assert_eq!(pool.render(&mut out, &params()), 2);
        assert_eq!(out[0], 5.0, "voice with note 1 was stolen by note 3");
    }

    #[test]
    fn finished_voices_are_reused_before_stealing() {
        let mut pool: Pool<Probe, 2> = Pool::new(48_000.0, Policy::PHASE_1);
        pool.trigger(1.0, 1.0, 1, 0, false, &params());
        pool.trigger(2.0, 1.0, 10, 0, false, &params());
        let mut out = [0.0];
        assert_eq!(pool.render(&mut out, &params()), 1);
        pool.trigger(4.0, 1.0, 10, 0, false, &params());
        let mut out = [0.0];
        pool.render(&mut out, &params());
        assert_eq!(
            out[0], 6.0,
            "note 2 survives, note 4 took the finished voice"
        );
    }

    #[test]
    fn released_quietest_reuses_the_same_note_first() {
        let mut pool: Pool<Probe, 3> = Pool::new(48_000.0, POLY);
        pool.trigger(1.0, 1.0, 10, 0, false, &params());
        pool.trigger(2.0, 1.0, 10, 0, false, &params());
        pool.trigger(1.0, 1.0, 10, 0, false, &params());
        assert_eq!(
            pool.active_count(),
            2,
            "the second note 1 took the first voice"
        );
    }

    #[test]
    fn released_quietest_takes_the_quietest_released_voice() {
        let mut pool: Pool<Probe, 2> = Pool::new(48_000.0, POLY);
        pool.trigger(1.0, 1.0, 4, 0, false, &params());
        pool.trigger(2.0, 1.0, 100, 0, false, &params());
        let mut out = [0.0];
        for _ in 0..3 {
            pool.render(&mut out, &params());
        }
        // Note 1 is released (life 1 of 4), note 2 is held: note 3 takes note 1's voice.
        pool.trigger(3.0, 1.0, 100, 0, false, &params());
        let mut out = [0.0];
        pool.render(&mut out, &params());
        assert_eq!(out[0], 5.0);
    }

    #[test]
    fn a_full_pool_without_released_voices_steals_the_oldest() {
        let mut pool: Pool<Probe, 2> = Pool::new(48_000.0, POLY);
        pool.trigger(1.0, 1.0, 100, 0, false, &params());
        pool.trigger(2.0, 1.0, 100, 0, false, &params());
        pool.trigger(3.0, 1.0, 100, 0, false, &params());
        let mut out = [0.0];
        pool.render(&mut out, &params());
        assert_eq!(out[0], 5.0);
    }

    #[test]
    fn mono_plays_legato_while_the_note_holds_and_retriggers_after() {
        let policy = Policy {
            mono: true,
            steal: Steal::Oldest,
        };
        let mut pool: Pool<Probe, 1> = Pool::new(48_000.0, policy);
        pool.trigger(1.0, 1.0, 10, 0, true, &params());
        let mut out = [0.0];
        pool.render(&mut out, &params());
        pool.trigger(2.0, 1.0, 10, 30, true, &params());
        assert!(
            pool.voices[0].legato,
            "a held note glides legato into the next"
        );
        let mut silence = [0.0; 200];
        pool.render(&mut silence, &params());
        for _ in 0..20 {
            pool.render(&mut silence, &params());
        }
        pool.trigger(3.0, 1.0, 10, 30, true, &params());
        assert!(
            !pool.voices[0].legato,
            "long after the release, a plain trigger"
        );
    }

    #[test]
    fn the_voice_limit_fades_extra_voices_and_caps_new_ones() {
        let mut pool: Pool<Probe, 4> = Pool::new(48_000.0, POLY);
        for note in 1..=4 {
            pool.trigger(note as f32, 1.0, 100, 0, false, &params());
        }
        pool.set_limit(2);
        assert!(pool.voices.iter().filter(|voice| voice.stolen).count() >= 1);
        let mut out = [0.0];
        pool.render(&mut out, &params());
        pool.render(&mut out, &params());
        assert!(pool.active_count() <= 2);
        pool.trigger(9.0, 1.0, 100, 0, false, &params());
        assert!(
            pool.active_count() <= 2,
            "a new note reuses a voice under the cap"
        );
        pool.set_limit(0);
        assert_eq!(pool.limit(), 4);
    }

    #[test]
    fn reset_clears_in_place() {
        let mut pool: Pool<Probe, 2> = Pool::new(48_000.0, POLY);
        pool.trigger(1.0, 1.0, 100, 0, false, &params());
        let address = pool.voices.as_ptr();
        pool.reset();
        assert_eq!(pool.active_count(), 0);
        assert_eq!(
            pool.voices.as_ptr(),
            address,
            "the voices were not reallocated"
        );
    }
}
