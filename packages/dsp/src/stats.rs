// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The `f64` stats block read by the worklet (layout in `ABI.md`). Cells 3 and 4 belong
//! to the worklet's JavaScript and are never written here.

pub const LATE_DROPS: usize = 0;
pub const QUEUE_DROPS: usize = 1;
pub const NAN_RESETS: usize = 2;
pub const UNKNOWN_MESSAGES: usize = 3;
pub const UNKNOWN_TARGETS: usize = 4;
pub const SLOT_CAPACITY: usize = 5;
const HEADER: usize = 6;
const PER_SLOT: usize = 4;

/// Per-slot record, in block order.
#[derive(Clone, Copy, Default)]
pub struct SlotStats {
    pub active_voices: f64,
    pub onset_count: f64,
    pub last_onset_frame: f64,
    pub voice_frames: f64,
}

pub struct Stats {
    cells: Vec<f64>,
}

impl Stats {
    /// Allocates room for `slot_capacity` slots; constructor only.
    pub fn with_capacity(slot_capacity: usize) -> Self {
        let mut cells = Vec::with_capacity(HEADER + PER_SLOT * slot_capacity);
        cells.resize(HEADER, 0.0);
        Stats { cells }
    }

    /// Grows the block to `slots` records. Message handler only: may reallocate, so
    /// the pointer can change.
    pub fn resize(&mut self, slots: usize) {
        self.cells.resize(HEADER + PER_SLOT * slots, 0.0);
        self.cells[SLOT_CAPACITY] = slots as f64;
    }

    pub fn add(&mut self, counter: usize, amount: u32) {
        self.cells[counter] += f64::from(amount);
    }

    pub fn get(&self, cell: usize) -> f64 {
        self.cells[cell]
    }

    pub fn set_slot(&mut self, slot: usize, record: SlotStats) {
        let base = HEADER + PER_SLOT * slot;
        self.cells[base] = record.active_voices;
        self.cells[base + 1] = record.onset_count;
        self.cells[base + 2] = record.last_onset_frame;
        self.cells[base + 3] = record.voice_frames;
    }

    pub fn slot(&self, slot: usize) -> SlotStats {
        let base = HEADER + PER_SLOT * slot;
        SlotStats {
            active_voices: self.cells[base],
            onset_count: self.cells[base + 1],
            last_onset_frame: self.cells[base + 2],
            voice_frames: self.cells[base + 3],
        }
    }

    pub fn cells(&self) -> &[f64] {
        &self.cells
    }
}
