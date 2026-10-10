// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Shared effects and the master chain. Every buffer is allocated in `Engine::new`.

pub mod delay;
pub mod gate;
pub mod inserts;
pub mod master;
pub mod reverb;
pub mod sidechain;

/// Zeroes at most `budget` samples of `buffers`, continuing from `cursor` (a flat
/// position across all of them). Returns true when everything is clear.
pub fn clear_chunk<'a>(
    buffers: impl Iterator<Item = &'a mut [f32]>,
    cursor: &mut usize,
    budget: usize,
) -> bool {
    let mut start = 0;
    let mut budget = budget;
    for buffer in buffers {
        let end = start + buffer.len();
        if *cursor < end {
            let from = *cursor - start;
            let to = (from + budget).min(buffer.len());
            buffer[from..to].fill(0.0);
            budget -= to - from;
            *cursor += to - from;
            if budget == 0 {
                // Possibly done, but the next call confirms it at no cost.
                return false;
            }
        }
        start = end;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clears_across_buffers_in_chunks() {
        let mut a = vec![1.0_f32; 5];
        let mut b = vec![1.0_f32; 7];
        let mut cursor = 0;
        let mut calls = 0;
        loop {
            calls += 1;
            let buffers = [a.as_mut_slice(), b.as_mut_slice()];
            if clear_chunk(buffers.into_iter(), &mut cursor, 4) {
                break;
            }
        }
        assert!(a.iter().chain(&b).all(|&x| x == 0.0));
        assert!(calls <= 4);
    }
}
