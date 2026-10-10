// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! A sample pack as the voices read it: 16-bit PCM at the pack's rate and its zone map.
//! A pack is immutable once delivered and lives as long as the WASM instance (the ABI has
//! no unload), so a voice keeps a `&'static` reference for as long as it plays.

/// `f64` cells of one zone in `untzel_samples_zones_ptr()` (`ABI.md`).
pub const ZONE_CELLS: usize = 8;

/// One looped stem: plays the notes in `lowest..highest` for one vowel.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Zone {
    /// Vowel position on the `vowel` axis, 0 (aah) .. 1 (ooh).
    pub position: f32,
    /// Notes `lowest <= note < highest` (midi, fractional) use this zone.
    pub lowest: f32,
    pub highest: f32,
    /// Pitch of the recording (midi, fractional).
    pub root: f32,
    /// First frame, loop start and loop end (exclusive) in the pack's PCM.
    pub start: u32,
    pub loop_start: u32,
    pub loop_end: u32,
    /// −1 (left) .. 1 (right): the stem's place in the stereo spread.
    pub pan: f32,
}

impl Zone {
    /// Reads and checks one zone's cells against a PCM of `frames`. None when a value is
    /// not finite, out of range or out of order.
    pub fn from_cells(cells: &[f64], frames: usize) -> Option<Zone> {
        let [
            position,
            lowest,
            highest,
            root,
            start,
            loop_start,
            loop_end,
            pan,
        ] = *cells
        else {
            return None;
        };
        if !cells.iter().all(|cell| cell.is_finite()) {
            return None;
        }
        let frame = |value: f64| {
            (value >= 0.0 && value.fract() == 0.0 && value <= frames as f64).then_some(value as u32)
        };
        let (start, loop_start, loop_end) = (frame(start)?, frame(loop_start)?, frame(loop_end)?);
        let ordered = start < loop_start && loop_start < loop_end && lowest < highest;
        let in_range = (0.0..=1.0).contains(&position)
            && (0.0..=127.0).contains(&root)
            && (-1.0..=1.0).contains(&pan);
        // The reader looks two frames past a position: a loop shorter than four frames
        // would wrap more than once per read.
        let long_enough = loop_end - loop_start >= 4;
        (ordered && in_range && long_enough).then_some(Zone {
            position: position as f32,
            lowest: lowest as f32,
            highest: highest as f32,
            root: root as f32,
            start,
            loop_start,
            loop_end,
            pan: pan as f32,
        })
    }

    pub fn contains(&self, note: f32) -> bool {
        self.lowest <= note && note < self.highest
    }
}

/// Vowels a pack may hold (aah, eeh, ooh, …); zones past this are ignored.
pub const MAX_VOWELS: usize = 4;

pub struct SamplePack {
    /// Rate the PCM was decoded at (48 kHz for Opus).
    pub sample_rate: f32,
    pub pcm: &'static [i16],
    pub zones: &'static [Zone],
    vowels: [f32; MAX_VOWELS],
    vowel_count: usize,
}

impl SamplePack {
    /// Message handler only: lists the vowels once, so a note never sorts anything.
    pub fn new(sample_rate: f32, pcm: &'static [i16], zones: &'static [Zone]) -> Self {
        let mut vowels = [0.0_f32; MAX_VOWELS];
        let mut vowel_count = 0;
        for zone in zones {
            if vowel_count < MAX_VOWELS && !vowels[..vowel_count].contains(&zone.position) {
                vowels[vowel_count] = zone.position;
                vowel_count += 1;
            }
        }
        vowels[..vowel_count].sort_unstable_by(f32::total_cmp);
        SamplePack {
            sample_rate,
            pcm,
            zones,
            vowels,
            vowel_count,
        }
    }

    /// The distinct vowel positions, ascending.
    pub fn vowels(&self) -> &[f32] {
        &self.vowels[..self.vowel_count]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CELLS: [f64; ZONE_CELLS] = [0.0, 58.0, 62.0, 60.0, 10.0, 100.0, 900.0, -0.5];

    #[test]
    fn a_well_formed_zone_is_read() {
        let zone = Zone::from_cells(&CELLS, 1_000).expect("valid");
        assert_eq!((zone.start, zone.loop_start, zone.loop_end), (10, 100, 900));
        assert!(zone.contains(58.0) && zone.contains(61.9) && !zone.contains(62.0));
    }

    #[test]
    fn a_zone_out_of_the_pcm_or_out_of_order_is_refused() {
        let with = |index: usize, value: f64| {
            let mut cells = CELLS;
            cells[index] = value;
            Zone::from_cells(&cells, 1_000)
        };
        assert!(with(6, 1_001.0).is_none(), "loop end past the PCM");
        assert!(with(5, 5.0).is_none(), "loop start before the start");
        assert!(with(4, 10.5).is_none(), "fractional frame");
        assert!(with(0, 1.5).is_none(), "vowel past ooh");
        assert!(with(7, f64::NAN).is_none(), "NaN pan");
        assert!(with(2, 50.0).is_none(), "highest below lowest");
        assert!(with(6, 102.0).is_none(), "loop of two frames");
        assert!(
            Zone::from_cells(&CELLS[..7], 1_000).is_none(),
            "missing cell"
        );
    }

    #[test]
    fn vowels_are_distinct_and_sorted() {
        let zone = Zone::from_cells(&CELLS, 1_000).unwrap();
        let ooh = Zone {
            position: 1.0,
            ..zone
        };
        let zones: &'static [Zone] = Box::leak(Box::new([ooh, zone, ooh]));
        let pack = SamplePack::new(48_000.0, &[], zones);
        assert_eq!(pack.vowels(), &[0.0, 1.0]);
    }
}
