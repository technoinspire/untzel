// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The spectrum of what strikes a modal bank: the hammer's raised-cosine
//! response, the contact's per-mode shaping, the start phases of a contact and a hand
//! slap. The bank (`super`) only rings what these functions decide.

use super::{Exciter, Mode};

/// How much a hammer of `seconds` excites a mode at `hz`, relative to a mode far below
/// it (the spectrum of a raised-cosine bump, |sinc(x) ÷ (1 − x²)| with x = hz × seconds).
/// A drum divides its level by this at its fundamental, so a soft or long hammer does not
/// make the drum quieter; never below `floor`, which bounds the compensation.
pub fn hammer_response(hz: f32, seconds: f32, floor: f32) -> f32 {
    let x = (hz * seconds).abs();
    let response = if (x - 1.0).abs() < 1e-3 {
        0.5
    } else if x < 1e-6 {
        1.0
    } else {
        let px = core::f32::consts::PI * x;
        (px.sin() / px / (1.0 - x * x)).abs()
    };
    response.max(floor)
}

/// Start phases of the modes of a contact, as (sin, cos) of 2π × 0, 0.62, 0.24, 0.86,
/// 0.47, 0.09, 0.71 and 0.33 (the golden-ratio walk): the fundamental starts like an
/// impulse response, the others scattered.
const SCATTER: [(f32, f32); 8] = [
    (0.0, 1.0),
    (-0.684_547, -0.728_969),
    (0.998_027, 0.062_791),
    (-0.770_513, 0.637_424),
    (0.187_381, -0.982_287),
    (0.535_827, 0.844_328),
    (-0.968_583, -0.248_690),
    (0.876_307, -0.481_754),
];

/// The resonator state (y1, y2) that sets mode `index` ringing at `amplitude` from its
/// scattered phase, for a mode with these `cos_w` and `sin_w`: a contact rings every
/// mode at once, each from its own phase (a real hammer reaches the partials at slightly
/// different times), so it has the spectrum of an impulse without the summed spike of
/// every partial in phase.
pub fn scattered_state(index: usize, amplitude: f32, cos_w: f32, sin_w: f32) -> (f32, f32) {
    let (sin_p, cos_p) = SCATTER[index % SCATTER.len()];
    (
        amplitude * sin_p,
        amplitude * (sin_p * cos_w - cos_p * sin_w),
    )
}

/// What a contact of `seconds` with `hardness` (0..1) excites at `hz`: the hard part is
/// an impulse (flat), the soft part a raised-cosine pulse (`hammer_response`).
fn contact_response(hz: f32, seconds: f32, hardness: f32) -> f32 {
    let hardness = hardness.clamp(0.0, 1.0);
    hardness + (1.0 - hardness) * hammer_response(hz, seconds, 0.0)
}

/// Shapes every mode by the contact's response, compensated per mode: the gains are
/// divided by the response at the fundamental `f0`, so a soft contact makes the sound
/// darker, never quieter.
pub fn shape_contact(modes: &mut [Mode], f0: f32, seconds: f32, hardness: f32) {
    let reference = contact_response(f0, seconds, hardness).max(1e-3);
    for mode in modes {
        mode.gain *= contact_response(mode.hz, seconds, hardness) / reference;
    }
}

/// A hand slap on a drum: the upper modes louder and shorter, struck by a
/// hard contact with a burst of skin noise. `amount` 0..1; returns the exciter to use.
pub fn slap(modes: &mut [Mode], amount: f32) -> Exciter {
    let amount = amount.clamp(0.0, 1.0);
    let count = modes.len().max(1) as f32;
    for (k, mode) in modes.iter_mut().enumerate() {
        mode.gain *= 1.0 + 3.0 * amount * k as f32 / count;
        mode.decay *= 1.0 - 0.6 * amount;
    }
    Exciter::Contact {
        seconds: 0.0006,
        noise: amount,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_hammer_response_falls_with_frequency_and_has_a_floor() {
        assert!((hammer_response(0.0, 0.004, 0.1) - 1.0).abs() < 1e-6);
        assert!((hammer_response(250.0, 0.004, 0.1) - 0.5).abs() < 1e-3);
        assert!(hammer_response(100.0, 0.004, 0.1) > hammer_response(200.0, 0.004, 0.1));
        assert_eq!(hammer_response(500.0, 0.004, 0.25), 0.25);
    }

    #[test]
    fn a_hard_contact_keeps_the_upper_modes_a_soft_one_darkens_them() {
        let f0 = 130.8;
        let modes = || {
            [1.0_f32, 2.0, 4.0, 6.0].map(|ratio| Mode {
                hz: f0 * ratio,
                gain: 1.0,
                decay: 1.0,
            })
        };
        let mut hard = modes();
        shape_contact(&mut hard, f0, 0.002, 1.0);
        assert!(hard.iter().all(|mode| (mode.gain - 1.0).abs() < 1e-6));
        let mut soft = modes();
        shape_contact(&mut soft, f0, 0.002, 0.0);
        assert!(
            (soft[0].gain - 1.0).abs() < 1e-6,
            "the fundamental is compensated"
        );
        assert!(soft[3].gain < soft[1].gain && soft[1].gain < 1.0);
    }

    #[test]
    fn the_fundamental_starts_like_an_impulse_response() {
        assert_eq!(scattered_state(0, 0.5, 0.9, 0.1), (0.0, -0.05));
    }
}
