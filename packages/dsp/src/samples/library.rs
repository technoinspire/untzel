// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The sample packs of one engine. A pack arrives in three steps, all in the message
//! handler: `reserve` allocates the PCM and the zone table in WASM memory, the worklet
//! copies into them, and `commit` checks every zone and schedules the pack from a frame.
//! From that frame on (`take_due`, on the audio thread, without allocating) the slots of
//! the instrument hand it to their voices; a note already sounding keeps its engine.
//!
//! A committed pack is leaked on purpose: it lives as long as the WASM instance, and a
//! voice keeps a `&'static` reference while it plays. One pack per instrument; the ABI
//! has no unload.

use crate::engines::sampler::{SamplePack, ZONE_CELLS, Zone};
use crate::instruments::INSTRUMENT_COUNT;

/// 2^24 frames (5.8 min at 48 kHz, 32 MB of PCM): a pack is a few tens of seconds.
pub const MAX_PACK_FRAMES: u32 = 1 << 24;
pub const MAX_ZONES: u32 = 512;
const MIN_SAMPLE_RATE: f32 = 8_000.0;
const MAX_SAMPLE_RATE: f32 = 384_000.0;

struct Upload {
    instrument_id: usize,
    sample_rate: f32,
    pcm: Vec<i16>,
    zones: Vec<f64>,
}

struct Entry {
    instrument_id: usize,
    pack: &'static SamplePack,
    ready_at: f64,
    delivered: bool,
}

pub struct SampleLibrary {
    upload: Option<Upload>,
    entries: Vec<Entry>,
}

impl Default for SampleLibrary {
    fn default() -> Self {
        Self::new()
    }
}

impl SampleLibrary {
    pub fn new() -> Self {
        SampleLibrary {
            upload: None,
            entries: Vec::with_capacity(INSTRUMENT_COUNT),
        }
    }

    /// Allocates the PCM (`frames` i16) and the zone table (`zones` × `ZONE_CELLS` f64)
    /// of a pack for `instrument_id`. Refused for an unknown instrument, one that already
    /// has a pack, or sizes out of range. A new reserve drops an upload not committed.
    pub fn reserve(
        &mut self,
        instrument_id: u32,
        frames: u32,
        zones: u32,
        sample_rate: f32,
    ) -> bool {
        let id = instrument_id as usize;
        let valid = id < INSTRUMENT_COUNT
            && (1..=MAX_PACK_FRAMES).contains(&frames)
            && (1..=MAX_ZONES).contains(&zones)
            && (MIN_SAMPLE_RATE..=MAX_SAMPLE_RATE).contains(&sample_rate)
            && !self.entries.iter().any(|entry| entry.instrument_id == id);
        self.upload = valid.then(|| Upload {
            instrument_id: id,
            sample_rate,
            pcm: vec![0; frames as usize],
            zones: vec![0.0; zones as usize * ZONE_CELLS],
        });
        valid
    }

    /// The reserved PCM and zone table, for the worklet (through pointers) and tests.
    pub fn upload_mut(&mut self) -> Option<(&mut [i16], &mut [f64])> {
        self.upload
            .as_mut()
            .map(|upload| (upload.pcm.as_mut_slice(), upload.zones.as_mut_slice()))
    }

    /// Checks every zone of the upload and makes it the instrument's pack from
    /// `at_frame`. Refused (and the upload dropped) when there is none or a zone is bad.
    pub fn commit(&mut self, at_frame: f64) -> bool {
        let Some(upload) = self.upload.take() else {
            return false;
        };
        if !at_frame.is_finite() {
            return false;
        }
        let frames = upload.pcm.len();
        let zones: Option<Vec<Zone>> = upload
            .zones
            .as_chunks::<ZONE_CELLS>()
            .0
            .iter()
            .map(|cells| Zone::from_cells(cells, frames))
            .collect();
        let Some(zones) = zones else {
            return false;
        };
        let pcm: &'static [i16] = Box::leak(upload.pcm.into_boxed_slice());
        let zones: &'static [Zone] = Box::leak(zones.into_boxed_slice());
        let pack: &'static SamplePack =
            Box::leak(Box::new(SamplePack::new(upload.sample_rate, pcm, zones)));
        self.entries.push(Entry {
            instrument_id: upload.instrument_id,
            pack,
            ready_at: at_frame,
            delivered: false,
        });
        true
    }

    /// Audio thread: the next pack whose frame has come, once. No allocation.
    pub fn take_due(&mut self, now: f64) -> Option<(usize, &'static SamplePack)> {
        let entry = self
            .entries
            .iter_mut()
            .find(|entry| !entry.delivered && entry.ready_at <= now)?;
        entry.delivered = true;
        Some((entry.instrument_id, entry.pack))
    }

    /// The pack an instrument's new slots start with, once it was delivered.
    pub fn delivered(&self, instrument_id: usize) -> Option<&'static SamplePack> {
        self.entries
            .iter()
            .find(|entry| entry.delivered && entry.instrument_id == instrument_id)
            .map(|entry| entry.pack)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn upload_one_zone(library: &mut SampleLibrary, loop_end: f64) {
        let (pcm, zones) = library.upload_mut().expect("reserved");
        pcm.iter_mut().enumerate().for_each(|(i, x)| *x = i as i16);
        zones.copy_from_slice(&[0.0, 0.0, 127.0, 60.0, 0.0, 10.0, loop_end, 0.0]);
    }

    #[test]
    fn a_pack_is_delivered_once_from_its_frame() {
        let mut library = SampleLibrary::new();
        assert!(library.reserve(0, 100, 1, 48_000.0));
        upload_one_zone(&mut library, 100.0);
        assert!(library.commit(1_000.0));
        assert!(library.take_due(999.0).is_none());
        assert!(library.delivered(0).is_none());
        let (id, pack) = library.take_due(1_000.0).expect("due");
        assert_eq!((id, pack.pcm.len(), pack.zones.len()), (0, 100, 1));
        assert!(library.take_due(2_000.0).is_none(), "once");
        assert!(library.delivered(0).is_some());
    }

    #[test]
    fn bad_uploads_are_refused() {
        let mut library = SampleLibrary::new();
        assert!(
            !library.reserve(INSTRUMENT_COUNT as u32, 100, 1, 48_000.0),
            "unknown instrument"
        );
        assert!(!library.reserve(0, 0, 1, 48_000.0), "no frames");
        assert!(!library.reserve(0, 100, 0, 48_000.0), "no zones");
        assert!(!library.reserve(0, 100, 1, f32::NAN), "rate");
        assert!(!library.commit(0.0), "nothing reserved");
        assert!(library.reserve(0, 100, 1, 48_000.0));
        upload_one_zone(&mut library, 101.0);
        assert!(!library.commit(0.0), "loop end past the PCM");
        assert!(!library.commit(0.0), "the refused upload is gone");
        assert!(library.reserve(0, 100, 1, 48_000.0));
        upload_one_zone(&mut library, 100.0);
        assert!(library.commit(0.0));
        assert!(
            !library.reserve(0, 100, 1, 48_000.0),
            "one pack per instrument"
        );
    }
}
