// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Plays one zone: 4-point Hermite interpolation between the 16-bit frames, the attack
//! once, then the loop forever. The pack's loop has its crossfade baked in; over the last
//! `SEAM_FRAMES` before the loop end the reader also crossfades into the frames before
//! the loop start, so the small codec error at the seam never clicks.

use super::pack::Zone;

/// Runtime crossfade over the loop seam, frames of the pack (4 ms at 48 kHz).
pub const SEAM_FRAMES: u32 = 192;
/// Fastest playback: four octaves above the root.
const MAX_STEP: f32 = 16.0;
const SCALE: f32 = 1.0 / 32_768.0;

#[derive(Clone, Copy, Default)]
pub struct ZoneReader {
    loop_start: u32,
    loop_end: u32,
    seam: u32,
    index: u32,
    fraction: f32,
    /// Fade gain of this reader (vowel weight and zone changes ramp it).
    gain: f32,
    gain_step: f32,
    gain_frames: u32,
    /// Pitch ratio of the zone at the played note, before modulation.
    pub ratio: f32,
    /// Stereo gains of the zone's pan.
    pub left: f32,
    pub right: f32,
    /// Detune of this reader against the others, as a ratio.
    pub detune: f32,
    /// The zone's pan and notes.
    pub pan: f32,
    lowest: f32,
    highest: f32,
    active: bool,
}

impl ZoneReader {
    /// Starts `zone` at its first frame, or at its loop start (a legato zone change).
    pub fn start(&mut self, zone: &Zone, ratio: f32, from_loop: bool, gain: f32) {
        self.loop_start = zone.loop_start;
        self.loop_end = zone.loop_end;
        self.seam = SEAM_FRAMES
            .min(zone.loop_start - zone.start)
            .min((zone.loop_end - zone.loop_start) / 2);
        self.index = if from_loop {
            zone.loop_start
        } else {
            zone.start
        };
        self.fraction = 0.0;
        self.gain = gain;
        self.gain_frames = 0;
        self.ratio = ratio;
        self.left = (1.0 - zone.pan).min(1.0);
        self.right = (1.0 + zone.pan).min(1.0);
        self.detune = 1.0;
        self.pan = zone.pan;
        self.lowest = zone.lowest;
        self.highest = zone.highest;
        self.active = true;
    }

    /// Whether `note` is inside this reader's zone.
    pub fn holds(&self, note: f32) -> bool {
        self.lowest <= note && note < self.highest
    }

    /// Moves the gain to `target` linearly over `frames` (0 jumps).
    pub fn fade_to(&mut self, target: f32, frames: u32) {
        if frames == 0 {
            self.gain = target;
            self.gain_frames = 0;
            return;
        }
        self.gain_step = (target - self.gain) / frames as f32;
        self.gain_frames = frames;
    }

    pub fn is_active(&self) -> bool {
        self.active
    }

    pub fn is_fading_out(&self) -> bool {
        self.gain_frames > 0 && self.gain_step < 0.0
    }

    pub fn stop(&mut self) {
        self.active = false;
    }

    /// The next frame at playback `step` (frames of the pack per output frame), times
    /// the reader's gain. A reader that has faded to zero stops.
    #[inline]
    pub fn next(&mut self, pcm: &[i16], step: f32) -> f32 {
        let mut value = self.at(pcm, self.index, self.fraction);
        let seam_start = self.loop_end - self.seam;
        if self.index >= seam_start {
            let weight = ((self.index - seam_start) as f32 + self.fraction) / self.seam as f32;
            let earlier = self.at(
                pcm,
                self.index - (self.loop_end - self.loop_start),
                self.fraction,
            );
            value += weight * (earlier - value);
        }
        let out = value * self.gain;
        self.skip(step);
        out
    }

    /// Moves on one output frame without reading (a vowel at zero weight keeps its place).
    #[inline]
    pub fn skip(&mut self, step: f32) {
        if self.gain_frames > 0 {
            self.gain_frames -= 1;
            self.gain = if self.gain_frames == 0 && self.gain_step < 0.0 {
                0.0
            } else {
                self.gain + self.gain_step
            };
            if self.gain <= 0.0 && self.gain_step < 0.0 {
                self.active = false;
            }
        }
        self.advance(step);
    }

    /// `skip` over one frame per entry of `modulation` (steps `base × modulation[n]`), at
    /// once when no fade is running.
    pub fn skip_frames(&mut self, base: f32, modulation: &[f32]) {
        if self.gain_frames > 0 {
            modulation.iter().for_each(|m| self.skip(base * m));
            return;
        }
        let total: f32 = modulation
            .iter()
            .map(|m| (base * m).clamp(0.0, MAX_STEP))
            .sum();
        self.fraction += total;
        let whole = self.fraction as u32;
        self.fraction -= whole as f32;
        self.index += whole;
        if self.index >= self.loop_end {
            self.index = self.loop_start
                + (self.index - self.loop_start) % (self.loop_end - self.loop_start);
        }
    }

    #[inline]
    fn advance(&mut self, step: f32) {
        self.fraction += step.clamp(0.0, MAX_STEP);
        let whole = self.fraction as u32;
        self.fraction -= whole as f32;
        self.index += whole;
        let length = self.loop_end - self.loop_start;
        while self.index >= self.loop_end {
            self.index -= length;
        }
    }

    /// Hermite interpolation at `index + fraction`; taps past the loop end wrap.
    #[inline]
    fn at(&self, pcm: &[i16], index: u32, fraction: f32) -> f32 {
        let length = self.loop_end - self.loop_start;
        let wrap = |k: u32| if k >= self.loop_end { k - length } else { k };
        let tap = |k: u32| f32::from(pcm[k as usize]) * SCALE;
        let x0 = tap(index.saturating_sub(1));
        let x1 = tap(index);
        let x2 = tap(wrap(index + 1));
        let x3 = tap(wrap(index + 2));
        let c1 = 0.5 * (x2 - x0);
        let c2 = x0 - 2.5 * x1 + 2.0 * x2 - 0.5 * x3;
        let c3 = 0.5 * (x3 - x0) + 1.5 * (x1 - x2);
        ((c3 * fraction + c2) * fraction + c1) * fraction + x1
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn zone(start: u32, loop_start: u32, loop_end: u32) -> Zone {
        Zone {
            position: 0.0,
            lowest: 0.0,
            highest: 127.0,
            root: 60.0,
            start,
            loop_start,
            loop_end,
            pan: 0.0,
        }
    }

    #[test]
    fn plays_the_attack_once_then_loops() {
        let pcm: Vec<i16> = (0..20).map(|i| (i * 1_000) as i16).collect();
        let mut reader = ZoneReader::default();
        reader.start(&zone(0, 8, 16), 1.0, false, 1.0);
        let positions: Vec<u32> = (0..24)
            .map(|_| {
                let index = reader.index;
                reader.next(&pcm, 1.0);
                index
            })
            .collect();
        assert_eq!(&positions[..10], &[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        assert!(
            positions[10..]
                .iter()
                .all(|&index| (8..16).contains(&index)),
            "{positions:?}"
        );
        assert_eq!(positions[16], 8, "frame 16 wrapped to the loop start");
    }

    #[test]
    fn hermite_reproduces_the_frames_and_a_line_between_them() {
        let pcm: Vec<i16> = (0..64).map(|i| (i * 100) as i16).collect();
        let mut reader = ZoneReader::default();
        reader.start(&zone(0, 32, 64), 1.0, false, 1.0);
        assert!((reader.at(&pcm, 10, 0.0) - 1_000.0 * SCALE).abs() < 1e-6);
        assert!((reader.at(&pcm, 10, 0.5) - 1_050.0 * SCALE).abs() < 1e-6);
    }

    #[test]
    fn skipping_frames_lands_where_reading_them_would() {
        let pcm = vec![0_i16; 64];
        let (mut read, mut skipped) = (ZoneReader::default(), ZoneReader::default());
        read.start(&zone(0, 8, 40), 1.0, false, 1.0);
        skipped.start(&zone(0, 8, 40), 1.0, false, 1.0);
        let modulation = [1.3731_f32; 100];
        modulation.iter().for_each(|m| {
            read.next(&pcm, 1.0 * m);
        });
        skipped.skip_frames(1.0, &modulation);
        assert_eq!(read.index, skipped.index);
        assert!((read.fraction - skipped.fraction).abs() < 1e-3);
    }

    #[test]
    fn a_fade_out_stops_the_reader() {
        let pcm = vec![1_000_i16; 64];
        let mut reader = ZoneReader::default();
        reader.start(&zone(0, 16, 64), 1.0, false, 1.0);
        reader.fade_to(0.0, 10);
        assert!(reader.is_fading_out());
        for _ in 0..10 {
            reader.next(&pcm, 1.0);
        }
        assert!(!reader.is_active());
    }
}
