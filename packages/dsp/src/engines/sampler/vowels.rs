// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Vowel blend of the sampler: `vowel` 0..1 moves between the recorded vowels of a pack
//! with equal power, so a sweep morphs aah into ooh without a drop.

use super::pack::MAX_VOWELS;

/// Equal-power weight of each vowel position (ascending) at `vowel`.
pub fn vowel_weights(positions: &[f32], vowel: f32) -> [f32; MAX_VOWELS] {
    let mut weights = [0.0; MAX_VOWELS];
    match positions.len() {
        0 => return weights,
        1 => {
            weights[0] = 1.0;
            return weights;
        }
        _ => {}
    }
    let last = positions.len() - 1;
    let vowel = vowel.clamp(positions[0], positions[last]);
    let upper = positions
        .iter()
        .position(|&p| p >= vowel)
        .unwrap_or(last)
        .clamp(1, last);
    let (low, high) = (positions[upper - 1], positions[upper]);
    let angle =
        ((vowel - low) / (high - low).max(1e-6)).clamp(0.0, 1.0) * core::f32::consts::FRAC_PI_2;
    weights[upper - 1] = angle.cos();
    weights[upper] = angle.sin();
    weights
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_vowels_blend_with_equal_power() {
        let positions = [0.0, 1.0];
        assert_eq!(vowel_weights(&positions, 0.0)[..2], [1.0, 0.0]);
        let middle = vowel_weights(&positions, 0.5);
        assert!((middle[0] * middle[0] + middle[1] * middle[1] - 1.0).abs() < 1e-5);
        let ooh = vowel_weights(&positions, 1.0);
        assert!(ooh[0].abs() < 1e-6 && (ooh[1] - 1.0).abs() < 1e-6);
    }

    #[test]
    fn three_vowels_blend_only_the_neighbours() {
        let weights = vowel_weights(&[0.0, 0.5, 1.0], 0.75);
        assert_eq!(weights[0], 0.0);
        assert!(weights[1] > 0.0 && weights[2] > 0.0);
        assert_eq!(vowel_weights(&[0.3], 0.9)[0], 1.0);
        assert_eq!(vowel_weights(&[], 0.5), [0.0; MAX_VOWELS]);
    }
}
