// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! A small diffuse tail inside a voice (the `impact`'s reverberated noise): four parallel feedback combs with damping and two allpasses, the classic
//! Schroeder layout. Its lines are allocated in `new` (message handler) and cleared in
//! place; nothing allocates on the audio thread.

/// Comb and allpass lengths at 48 kHz (mutually prime), scaled to the sample rate.
const COMBS: [f32; 4] = [1_557.0, 1_617.0, 1_491.0, 1_422.0];
const ALLPASSES: [f32; 2] = [556.0, 441.0];
const ALLPASS_GAIN: f32 = 0.5;
/// High frequencies fade faster in the tail (one-pole damping in each comb).
const DAMPING: f32 = 0.15;

struct Line {
    buffer: Box<[f32]>,
    index: usize,
    damped: f32,
}

impl Line {
    fn new(length: usize) -> Self {
        Line {
            buffer: vec![0.0; length.max(1)].into_boxed_slice(),
            index: 0,
            damped: 0.0,
        }
    }

    #[inline]
    fn read(&self) -> f32 {
        self.buffer[self.index]
    }

    #[inline]
    fn write(&mut self, value: f32) {
        self.buffer[self.index] = value;
        self.index = (self.index + 1) % self.buffer.len();
    }

    fn clear(&mut self) {
        self.buffer.fill(0.0);
        self.index = 0;
        self.damped = 0.0;
    }
}

pub struct Wash {
    sample_rate: f32,
    combs: [Line; 4],
    allpasses: [Line; 2],
    feedback: [f32; 4],
}

impl Wash {
    /// Message handler only: allocates the lines.
    pub fn new(sample_rate: f32) -> Self {
        let scale = sample_rate / 48_000.0;
        Wash {
            sample_rate,
            combs: COMBS.map(|length| Line::new((length * scale) as usize)),
            allpasses: ALLPASSES.map(|length| Line::new((length * scale) as usize)),
            feedback: [0.0; 4],
        }
    }

    /// Sets the tail to fall 60 dB in `seconds`.
    pub fn set_decay(&mut self, seconds: f32) {
        let seconds = seconds.max(0.05);
        for (feedback, comb) in self.feedback.iter_mut().zip(&self.combs) {
            let delay = comb.buffer.len() as f32 / self.sample_rate;
            *feedback = 10.0_f32.powf(-3.0 * delay / seconds).min(0.98);
        }
    }

    #[inline]
    pub fn process(&mut self, input: f32) -> f32 {
        let mut sum = 0.0;
        for (comb, &feedback) in self.combs.iter_mut().zip(&self.feedback) {
            let delayed = comb.read();
            comb.damped = delayed + DAMPING * (comb.damped - delayed);
            comb.write(input + feedback * comb.damped);
            sum += delayed;
        }
        let mut x = 0.25 * sum;
        for allpass in &mut self.allpasses {
            let delayed = allpass.read();
            let y = delayed - ALLPASS_GAIN * x;
            allpass.write(x + ALLPASS_GAIN * y);
            x = y;
        }
        x
    }

    /// Clears every line in place (audio thread: no allocation).
    pub fn reset(&mut self) {
        for line in self.combs.iter_mut().chain(self.allpasses.iter_mut()) {
            line.clear();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_impulse_rings_for_about_the_decay_and_stays_finite() {
        let mut wash = Wash::new(48_000.0);
        wash.set_decay(1.0);
        let mut energy = [0.0_f32; 3];
        for n in 0..144_000 {
            let y = wash.process(if n == 0 { 1.0 } else { 0.0 });
            assert!(y.is_finite());
            energy[n / 48_000] += y * y;
        }
        assert!(
            energy[0] > 0.0 && energy[1] < energy[0] * 1e-3,
            "{energy:?}"
        );
    }
}
