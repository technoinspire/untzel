// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Sample packs: `vox` and `choir` sing on the formants until their pack is
//! committed, then the notes that start from the commit frame on play the samples; a
//! note already sounding keeps its engine, so the swap never clicks. The packs here are
//! synthetic: a 300 Hz sine (160 frames per period at 48 kHz) looped on whole periods.

mod common;

use common::{engine, largest_step, live_slot, play, render, render_slot};
use untzel_dsp::engine::Engine;
use untzel_dsp::engines::sampler::ZONE_CELLS;
use untzel_dsp::instruments::{choir, vox};
use untzel_dsp::params::INSTRUMENT_BASE;

const RATE: f32 = 48_000.0;
const PERIOD: usize = 160;
/// Midi pitch of 300 Hz.
const ROOT: f64 = 62.368_825;
const STEM_FRAMES: usize = 200 * PERIOD;
const AMPLITUDE: f32 = 0.5;

fn sine(frames: usize) -> impl Iterator<Item = i16> {
    (0..frames).map(|n| {
        let phase = (n % PERIOD) as f32 / PERIOD as f32;
        ((phase * core::f32::consts::TAU).sin() * AMPLITUDE * 32_767.0) as i16
    })
}

/// One stem per entry of `pans` (vowel aah, every note); `silent_right` leaves the stems
/// panned right silent, so the spread shows as a level difference.
fn commit_pack(
    engine: &mut Engine,
    instrument: &str,
    pans: &[f64],
    silent_right: bool,
    at_frame: f64,
) {
    let id = common::instrument_id(instrument);
    let frames = (STEM_FRAMES * pans.len()) as u32;
    let library = engine.samples_mut();
    assert!(library.reserve(id, frames, pans.len() as u32, RATE));
    let (pcm, zones) = library.upload_mut().expect("reserved");
    for (index, &pan) in pans.iter().enumerate() {
        let start = index * STEM_FRAMES;
        let stem = &mut pcm[start..start + STEM_FRAMES];
        if !(silent_right && pan > 0.0) {
            stem.iter_mut()
                .zip(sine(STEM_FRAMES))
                .for_each(|(x, s)| *x = s);
        }
        let cells = [
            0.0,
            0.0,
            128.0,
            ROOT,
            start as f64,
            (start + 20 * PERIOD) as f64,
            (start + STEM_FRAMES) as f64,
            pan,
        ];
        zones[index * ZONE_CELLS..(index + 1) * ZONE_CELLS].copy_from_slice(&cells);
    }
    assert!(library.commit(at_frame));
}

fn rms(signal: &[f32]) -> f32 {
    (signal.iter().map(|x| x * x).sum::<f32>() / signal.len() as f32).sqrt()
}

fn sampled(engine: &mut Engine, slot: u32, source_index: usize) {
    engine.param_set(slot, (INSTRUMENT_BASE + source_index) as u32, 1.0);
}

/// Frequency of `signal` from its rising zero crossings.
fn frequency(signal: &[f32]) -> f32 {
    let crossings: Vec<usize> = (1..signal.len())
        .filter(|&n| signal[n - 1] < 0.0 && signal[n] >= 0.0)
        .collect();
    let (first, last) = (crossings[0], *crossings.last().unwrap());
    (crossings.len() - 1) as f32 * RATE / (last - first) as f32
}

#[test]
fn choir_sings_on_formants_until_its_pack_then_plays_it_spread() {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "choir");
    engine.param_set(slot, (INSTRUMENT_BASE + choir::RELEASE) as u32, 0.02);
    play(&mut engine, slot, 0.0, 60.0, 9_600.0);
    let before = render(&mut engine, 0.0, 48_000);
    assert!(before.peak() > 0.0);
    assert_eq!(before.left, before.right, "formants are centred");

    commit_pack(&mut engine, "choir", &[-0.55, 0.55], true, 96_000.0);
    play(&mut engine, slot, 96_000.0, ROOT as f32, 96_000.0);
    let after = render(&mut engine, 48_000.0, 96_000);
    let (left, right) = (&after.left[72_000..], &after.right[72_000..]);
    let ratio = rms(right) / rms(left);
    assert!(
        (ratio - 0.45).abs() < 0.03,
        "the left stem sounds 0.45 on the right: {ratio}"
    );
}

#[test]
fn a_note_already_sounding_keeps_its_engine_across_the_commit() {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "choir");
    play(&mut engine, slot, 0.0, 60.0, 96_000.0);
    commit_pack(&mut engine, "choir", &[-0.55, 0.55], true, 12_800.0);
    let rendered = render(&mut engine, 0.0, 38_400);
    assert_eq!(
        rendered.left, rendered.right,
        "still the centred formants after the commit"
    );
    let step = largest_step(&rendered.left, 12_000..14_000);
    let elsewhere = largest_step(&rendered.left, 20_000..30_000);
    assert!(
        step <= elsewhere * 1.5,
        "no click at the commit frame: {step} vs {elsewhere}"
    );
}

#[test]
fn vox_samples_follow_the_note_and_the_loop_never_clicks() {
    let mut engine = engine(RATE);
    let slot = live_slot(&mut engine, "vox");
    sampled(&mut engine, slot, vox::SOURCE);
    commit_pack(&mut engine, "vox", &[0.0], false, 0.0);
    let note = ROOT as f32 + 3.0;
    play(&mut engine, slot, 0.0, note, 4.0 * f64::from(RATE));
    let signal = render_slot(&mut engine, slot, 0.0, 3 * 48_000);
    // Past the attack and the vibrato onset; the loop wraps every 0.6 s.
    let sustain = &signal[48_000..];
    let expected = 300.0 * 2.0_f32.powf(3.0 / 12.0);
    let measured = frequency(sustain);
    assert!(
        (measured / expected - 1.0).abs() < 0.006,
        "{measured} Hz, expected {expected} (vibrato included)"
    );
    let peak = sustain.iter().fold(0.0_f32, |max, x| max.max(x.abs()));
    let smooth = peak * core::f32::consts::TAU * expected * 1.03 / RATE;
    assert!(
        largest_step(&signal, 48_000..signal.len()) < 1.5 * smooth,
        "no step larger than the sine's own"
    );
}

#[test]
fn synth_sounds_are_bit_identical_with_or_without_a_pack() {
    let run = |with_pack: bool| {
        let mut engine = engine(RATE);
        if with_pack {
            commit_pack(&mut engine, "vox", &[0.0], false, 0.0);
        }
        let slot = live_slot(&mut engine, "vox");
        play(&mut engine, slot, 0.0, 60.0, 20_000.0);
        play(&mut engine, slot, 20_000.0, 67.0, 20_000.0);
        render(&mut engine, 0.0, 48_000)
    };
    let (without, with) = (run(false), run(true));
    assert!(without.peak() > 0.0);
    assert_eq!(without.left, with.left);
    assert_eq!(without.right, with.right);
}

#[test]
fn a_slot_created_after_the_delivery_starts_with_the_pack() {
    let mut engine = engine(RATE);
    commit_pack(&mut engine, "choir", &[-0.55, 0.55], true, 0.0);
    render(&mut engine, 0.0, 128);
    let slot = live_slot(&mut engine, "choir");
    assert_eq!(choir::SOURCE_CHOICES, 2);
    play(&mut engine, slot, 256.0, ROOT as f32, 24_000.0);
    let rendered = render(&mut engine, 128.0, 24_064);
    assert_ne!(
        rendered.left, rendered.right,
        "the default choir plays the samples"
    );
}

#[test]
fn the_abi_reserves_and_commits_through_numbers_only() {
    use untzel_dsp::samples::abi::{
        untzel_samples_commit, untzel_samples_pcm_ptr, untzel_samples_reserve,
        untzel_samples_zones_ptr,
    };
    assert_eq!(untzel_samples_reserve(0, 10, 1, RATE), 1, "no engine yet");
    assert_eq!(untzel_dsp::abi::untzel_engine_new(RATE), 0);
    let choir = common::instrument_id("choir");
    assert_eq!(
        untzel_samples_reserve(u32::MAX, 10, 1, RATE),
        1,
        "unknown instrument"
    );
    assert_eq!(untzel_samples_commit(0.0), 1, "nothing reserved");
    assert_eq!(untzel_samples_reserve(choir, 1_000, 1, RATE), 0);
    assert_ne!(untzel_samples_pcm_ptr(), 0);
    assert_ne!(untzel_samples_zones_ptr(), 0);
    assert_eq!(untzel_samples_commit(0.0), 1, "zeroed zones are refused");
    assert_eq!(untzel_samples_pcm_ptr(), 0, "the refused upload is gone");
}
