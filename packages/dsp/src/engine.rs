// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The engine behind the ABI: slots, the event and parameter queues, the shared buses
//! and the master chain. Everything is allocated in `new` or in the message-handler
//! methods; `render` never allocates.
//!
//! `render` splits the block at every event frame, parameter point, tempo change and
//! ramp end, so events start on their exact sample and every ramp is linear inside a
//! sub-block (per-sample scheduling).
//!
//! Over 300 lines: the render loop and the message handlers share the slots and the queues on the audio thread; it is split only with its own render measurement.

use crate::events::{NoteEvent, ParamPoint, Timed, TimedQueue};
use crate::fx::clear_chunk;
use crate::fx::delay::Delay;
use crate::fx::master::{Master, StopFade};
use crate::fx::reverb::Reverb;
use crate::fx::sidechain::Sidechain;
use crate::mix::Buses;
use crate::samples::SampleLibrary;
use crate::slot::{BLOCK, Levels, Lifecycle, Slot};
use crate::stats::{LATE_DROPS, NAN_RESETS, QUEUE_DROPS, SlotStats, Stats};

pub const INITIAL_SLOT_CAPACITY: usize = 64;
pub const EVENT_CAPACITY: usize = 8_192;
pub const POINT_CAPACITY: usize = 4_096;
const TEMPO_CAPACITY: usize = 64;
/// A late event plays at the block start if it is at most this late; else it drops.
const MAX_LATENESS: f64 = BLOCK as f64;
/// Effect memory zeroed per block after a stop.
const CLEAR_CHUNK: usize = 65_536;
const MIN_SAMPLE_RATE: f32 = 8_000.0;
const MAX_SAMPLE_RATE: f32 = 384_000.0;

/// The queue had no room; the item was dropped and counted in `queueDrops`.
#[derive(Debug, PartialEq, Eq)]
pub struct QueueFull;

#[derive(Clone, Copy)]
struct TempoChange {
    bpm: f64,
    frame: f64,
}

impl Timed for TempoChange {
    fn frame(&self) -> f64 {
        self.frame
    }
    fn slot(&self) -> u32 {
        0
    }
}

enum Playback {
    Running,
    /// `untzel_stop`: master fading to zero; events after the fade start wait.
    Fading(StopFade),
    /// Voices are reset; effect memory is zeroed `CLEAR_CHUNK` samples per block.
    Clearing {
        cursor: usize,
    },
}

pub struct Engine {
    sample_rate: f32,
    ramp_frames: u32,
    slots: Vec<Option<Slot>>,
    events: TimedQueue<NoteEvent>,
    points: TimedQueue<ParamPoint>,
    tempos: TimedQueue<TempoChange>,
    buses: Box<Buses>,
    sidechain: Sidechain,
    reverb: Reverb,
    delay: Delay,
    master: Master,
    output: Box<[f32; 2 * BLOCK]>,
    /// `[sumSquares, frames, peak]` of the last `slot_levels` read (`untzel_levels_ptr`).
    levels: Box<[f64; 3]>,
    stats: Stats,
    playback: Playback,
    /// Sample packs (`vox`, `choir`): received in the handler, handed to slots in render.
    samples: SampleLibrary,
}

impl Engine {
    /// Pre-allocates every queue, bus and effect. None for an invalid sample rate.
    pub fn new(sample_rate: f32) -> Option<Self> {
        if !(MIN_SAMPLE_RATE..=MAX_SAMPLE_RATE).contains(&sample_rate) {
            return None;
        }
        let ramp_frames = (0.020 * sample_rate).round() as u32;
        let mut stats = Stats::with_capacity(INITIAL_SLOT_CAPACITY);
        stats.resize(0);
        Some(Engine {
            sample_rate,
            ramp_frames,
            slots: Vec::with_capacity(INITIAL_SLOT_CAPACITY),
            events: TimedQueue::with_capacity(EVENT_CAPACITY),
            points: TimedQueue::with_capacity(POINT_CAPACITY),
            tempos: TimedQueue::with_capacity(TEMPO_CAPACITY),
            buses: Box::default(),
            sidechain: Sidechain::new(sample_rate),
            reverb: Reverb::new(sample_rate),
            delay: Delay::new(sample_rate, ramp_frames),
            master: Master::new(sample_rate, ramp_frames),
            output: Box::new([0.0; 2 * BLOCK]),
            levels: Box::new([0.0; 3]),
            stats,
            playback: Playback::Running,
            samples: SampleLibrary::new(),
        })
    }

    pub fn sample_rate(&self) -> f32 {
        self.sample_rate
    }

    /// `round(0.020 × sampleRate)`: the ramp of an immediate change.
    pub fn ramp_frames(&self) -> u32 {
        self.ramp_frames
    }

    /// Constant delay of the output relative to the event frames (limiter lookahead).
    pub fn latency_frames(&self) -> usize {
        self.master.latency_frames()
    }

    // ---- Message handler (may allocate) ----

    /// New `Pending` slot, or None for an unknown instrument id.
    pub fn instance_create(&mut self, instrument_id: u32) -> Option<u32> {
        let mut slot = Slot::new(instrument_id as usize, self.sample_rate, self.ramp_frames)?;
        slot.use_samples(self.samples.delivered(instrument_id as usize));
        let index = match self.slots.iter().position(Option::is_none) {
            Some(free) => {
                self.slots[free] = Some(slot);
                free
            }
            None => {
                self.slots.push(Some(slot));
                self.slots.len() - 1
            }
        };
        self.stats.resize(self.slots.len());
        self.stats.set_slot(index, SlotStats::default());
        Some(index as u32)
    }

    pub fn param_set(&mut self, slot: u32, param: u32, value: f32) {
        if let Some(slot) = self.slot_mut(slot) {
            slot.params.set(param as usize, value);
        }
    }

    pub fn instance_activate(&mut self, slot: u32, at_frame: f64) {
        if let Some(slot) = self.slot_mut(slot) {
            slot.activate(at_frame);
        }
    }

    pub fn instance_retire(&mut self, slot: u32, at_frame: f64) {
        if let Some(slot) = self.slot_mut(slot) {
            slot.retire(at_frame);
        }
    }

    /// CPU protection: at most `max_voices` voices of the slot sound (0 = no cap).
    /// Returns false for an unknown slot.
    pub fn voice_limit(&mut self, slot: u32, max_voices: u32) -> bool {
        match self.slot_mut(slot) {
            Some(slot) => {
                slot.set_voice_limit(max_voices as usize);
                true
            }
            None => false,
        }
    }

    /// `untzel_effect_order`: writes `kind` at `position` of the slot's pending order.
    pub fn effect_order(&mut self, slot: u32, position: u32, kind: u32) -> bool {
        self.slot_mut(slot)
            .is_some_and(|slot| slot.effect_order(position, kind))
    }

    /// `untzel_effects_commit`: the pending order with `count` effects from `at_frame`.
    pub fn effects_commit(&mut self, slot: u32, count: u32, at_frame: f64) -> bool {
        self.slot_mut(slot)
            .is_some_and(|slot| slot.effects_commit(count, at_frame))
    }

    /// `untzel_modulator_set`: a fast LFO on `param`.
    #[allow(clippy::too_many_arguments)]
    pub fn modulator_set(
        &mut self,
        slot: u32,
        param: u32,
        shape: u32,
        curve: u32,
        period_frames: f64,
        origin_frame: f64,
        low: f32,
        high: f32,
    ) -> bool {
        self.slot_mut(slot).is_some_and(|slot| {
            slot.modulator_set(param, shape, curve, period_frames, origin_frame, low, high)
        })
    }

    /// `untzel_envelope_set`: a per-note envelope on `param`.
    pub fn envelope_set(
        &mut self,
        slot: u32,
        param: u32,
        curve: u32,
        seconds: f32,
        from: f32,
        to: f32,
    ) -> bool {
        self.slot_mut(slot)
            .is_some_and(|slot| slot.envelope_set(param, curve, seconds, from, to))
    }

    /// `untzel_modulator_clear`.
    pub fn modulator_clear(&mut self, slot: u32, param: u32) -> bool {
        self.slot_mut(slot)
            .is_some_and(|slot| slot.modulator_clear(param))
    }

    /// Copies the slot's level sums since the last read into `levels()` and restarts
    /// them. Returns false for an unknown slot.
    pub fn slot_levels(&mut self, slot: u32) -> bool {
        let Some(slot) = self.slot_mut(slot) else {
            return false;
        };
        let Levels {
            sum_squares,
            frames,
            peak,
        } = slot.take_levels();
        *self.levels = [sum_squares, frames, peak];
        true
    }

    pub fn levels(&self) -> &[f64; 3] {
        &self.levels
    }

    /// The sample packs, for `untzel_samples_*` (message handler).
    pub fn samples_mut(&mut self) -> &mut SampleLibrary {
        &mut self.samples
    }

    /// Test hook, outside the ABI: the slot's next block counts as non-finite, so the
    /// NaN recovery path runs exactly as it would for a real defect.
    #[doc(hidden)]
    pub fn poison_slot(&mut self, slot: u32) {
        if let Some(slot) = self.slot_mut(slot) {
            slot.poison();
        }
    }

    /// Frees every `Finished` slot and drops what was still queued for it.
    pub fn collect(&mut self) -> u32 {
        let mut freed = 0;
        for index in 0..self.slots.len() {
            if self.slots[index].as_ref().is_some_and(Slot::is_finished) {
                self.slots[index] = None;
                self.events.discard_slot(index as u32);
                self.points.discard_slot(index as u32);
                self.stats.set_slot(index, SlotStats::default());
                freed += 1;
            }
        }
        freed
    }

    /// Events for an unknown slot or with a non-finite frame are ignored.
    pub fn event_push(&mut self, event: NoteEvent) -> Result<(), QueueFull> {
        if self.slot_mut(event.slot).is_none() || !event.frame.is_finite() {
            return Ok(());
        }
        self.events.push(event).map_err(|_| self.count_queue_drop())
    }

    pub fn param_push(&mut self, point: ParamPoint) -> Result<(), QueueFull> {
        if self.slot_mut(point.slot).is_none() || !point.frame.is_finite() {
            return Ok(());
        }
        self.points.push(point).map_err(|_| self.count_queue_drop())
    }

    /// From `at_frame` the delay lines glide to the new tempo in 20 ms.
    pub fn tempo(&mut self, bpm: f64, at_frame: f64) {
        if bpm.is_finite() && bpm > 0.0 && at_frame.is_finite() {
            let change = TempoChange {
                bpm,
                frame: at_frame,
            };
            if self.tempos.push(change).is_err() {
                self.count_queue_drop();
            }
        }
    }

    pub fn master_gain(&mut self, value: f32) {
        self.master.set_gain(value);
    }

    /// Drops queued events and points from `at_frame` on and fades the master to zero
    /// in 20 ms; then voices and buses are cleared.
    pub fn stop(&mut self, at_frame: f64) {
        let at = if at_frame.is_finite() { at_frame } else { 0.0 };
        self.events.discard_from(at);
        self.points.discard_from(at);
        self.playback = match self.playback {
            Playback::Running => Playback::Fading(StopFade {
                at,
                frames: self.ramp_frames,
            }),
            Playback::Fading(fade) => Playback::Fading(StopFade {
                at: fade.at.min(at),
                ..fade
            }),
            Playback::Clearing { cursor } => Playback::Clearing { cursor },
        };
    }

    // ---- Audio thread (never allocates) ----

    /// Renders `frames` (at most 128) samples starting at `frame` into the output.
    pub fn render(&mut self, frame: f64, frames: usize) {
        let frames = frames.min(BLOCK);
        self.output.fill(0.0);
        if let Playback::Clearing { cursor } = &mut self.playback {
            let buffers = self.delay.buffers_mut().chain(self.reverb.buffers_mut());
            if clear_chunk(buffers, cursor, CLEAR_CHUNK) {
                self.playback = Playback::Running;
            }
            self.write_stats();
            return;
        }
        self.drop_late_events(frame);
        let mut cursor = 0;
        while cursor < frames {
            let now = frame + cursor as f64;
            self.apply_due(now);
            let end = self.next_split(frame, cursor, frames);
            self.render_span(now, cursor, end - cursor);
            cursor = end;
        }
        if let Playback::Fading(fade) = self.playback
            && frame + frames as f64 >= fade.end()
        {
            self.reset_after_stop();
        }
        self.write_stats();
    }

    /// Planar output: `[0, 128)` left, `[128, 256)` right.
    pub fn output(&self) -> &[f32; 2 * BLOCK] {
        &self.output
    }

    pub fn stats(&self) -> &Stats {
        &self.stats
    }

    /// Mono signal of a slot in the last block, before gain, pan and sends.
    pub fn slot_signal(&self, slot: u32) -> Option<&[f32]> {
        let slot = self.slots.get(slot as usize)?.as_ref()?;
        Some(slot.signal(0, BLOCK))
    }

    pub fn slot_lifecycle(&self, slot: u32, frame: f64) -> Option<Lifecycle> {
        Some(self.slots.get(slot as usize)?.as_ref()?.lifecycle(frame))
    }

    // ---- Internals ----

    fn slot_mut(&mut self, slot: u32) -> Option<&mut Slot> {
        self.slots.get_mut(slot as usize)?.as_mut()
    }

    fn count_queue_drop(&mut self) -> QueueFull {
        self.stats.add(QUEUE_DROPS, 1);
        QueueFull
    }

    /// While fading out, events at or after the fade start belong to the next play.
    fn is_deferred(&self, event: &NoteEvent) -> bool {
        matches!(self.playback, Playback::Fading(fade) if event.frame >= fade.at)
    }

    fn drop_late_events(&mut self, frame: f64) {
        while let Some(event) = self.events.peek() {
            if frame - event.frame <= MAX_LATENESS {
                break;
            }
            self.events.pop();
            self.stats.add(LATE_DROPS, 1);
        }
    }

    /// Applies everything due at `now`: late items land on the block start. A pack
    /// due at `now` reaches its slots before the notes of `now` start.
    fn apply_due(&mut self, now: f64) {
        while let Some((instrument_id, pack)) = self.samples.take_due(now) {
            for slot in self
                .slots
                .iter_mut()
                .flatten()
                .filter(|slot| slot.instrument_id() == instrument_id)
            {
                slot.use_samples(Some(pack));
            }
        }
        while let Some(&event) = self.events.peek() {
            if event.frame > now || self.is_deferred(&event) {
                break;
            }
            self.events.pop();
            if let Some(slot) = self.slot_mut(event.slot) {
                slot.trigger(event.frame, now, event.duration, event.note, event.velocity);
            }
        }
        while let Some(&point) = self.points.peek() {
            if point.frame > now {
                break;
            }
            self.points.pop();
            if let Some(slot) = self.slot_mut(point.slot) {
                slot.params
                    .ramp_to(point.param as usize, point.value, point.ramp);
            }
        }
        while let Some(&change) = self.tempos.peek() {
            if change.frame > now {
                break;
            }
            self.tempos.pop();
            self.delay.set_tempo_ramped(change.bpm);
        }
        for slot in self.slots.iter_mut().flatten() {
            slot.modulate(now);
        }
    }

    /// End (exclusive offset in the block) of the sub-block that starts at `cursor`.
    fn next_split(&self, frame: f64, cursor: usize, frames: usize) -> usize {
        let offset = |at: f64| (at - frame).ceil().max(0.0) as usize;
        let mut end = frames;
        if let Some(event) = self.events.peek().filter(|event| !self.is_deferred(event)) {
            end = end.min(offset(event.frame));
        }
        if let Some(point) = self.points.peek() {
            end = end.min(offset(point.frame));
        }
        if let Some(change) = self.tempos.peek() {
            end = end.min(offset(change.frame));
        }
        for slot in self.slots.iter().flatten() {
            if let Some(remaining) = slot.params.frames_to_next_ramp_end() {
                end = end.min(cursor + remaining as usize);
            }
        }
        end.max(cursor + 1)
    }

    fn render_span(&mut self, now: f64, offset: usize, len: usize) {
        self.buses.clear(len);
        let mut nan_resets = 0;
        for slot in self.slots.iter_mut().flatten() {
            nan_resets += u32::from(slot.render_voices(offset, len, now));
            slot.meter(offset, len);
        }
        for slot in self.slots.iter().flatten() {
            if slot.feeds_sidechain() && slot.is_sounding() {
                self.buses.feed_sidechain(slot, offset, len);
            }
        }
        self.sidechain.follow(&mut self.buses.sidechain[..len]);
        for slot in self.slots.iter_mut().flatten() {
            if slot.is_sounding() {
                self.buses.mix(slot, offset, len);
            }
            slot.end_sub_block(now, len);
        }
        if nan_resets > 0 {
            self.stats.add(NAN_RESETS, nan_resets);
        }
        self.render_buses(now, offset, len);
    }

    /// Shared effects into the dry bus, the master chain, then the output.
    fn render_buses(&mut self, now: f64, offset: usize, len: usize) {
        let Buses {
            dry, reverb, delay, ..
        } = &mut *self.buses;
        let [left, right] = dry;
        let (left, right) = (&mut left[..len], &mut right[..len]);
        let reverb_inputs = reverb.each_ref().map(|[l, r]| [&l[..len], &r[..len]]);
        let delay_inputs = delay.each_ref().map(|[l, r]| [&l[..len], &r[..len]]);
        self.reverb
            .process(&reverb_inputs, [&mut *left, &mut *right]);
        self.delay.process(&delay_inputs, [&mut *left, &mut *right]);
        let fade = match self.playback {
            Playback::Fading(fade) => Some(fade),
            _ => None,
        };
        self.master.process([&mut *left, &mut *right], now, fade);
        self.output[offset..offset + len].copy_from_slice(left);
        self.output[BLOCK + offset..BLOCK + offset + len].copy_from_slice(right);
    }

    fn reset_after_stop(&mut self) {
        for slot in self.slots.iter_mut().flatten() {
            slot.reset();
        }
        self.sidechain.reset();
        self.master.reset();
        self.delay.reset_state();
        self.reverb.reset_state();
        self.playback = Playback::Clearing { cursor: 0 };
    }

    fn write_stats(&mut self) {
        for (index, slot) in self.slots.iter().enumerate() {
            let record = slot
                .as_ref()
                .map_or(SlotStats::default(), |slot| SlotStats {
                    active_voices: f64::from(slot.active_voices),
                    onset_count: slot.onset_count,
                    last_onset_frame: slot.last_onset_frame,
                    voice_frames: slot.voice_frames,
                });
            self.stats.set_slot(index, record);
        }
    }
}
