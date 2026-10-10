// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! The instrumentId order of the WASM equals the registry order (sorted by name),
//! and each id exports the fnv1a32 of its manifest name.

use std::fs;
use std::path::Path;

use untzel_dsp::abi::{untzel_instrument_count, untzel_instrument_name_hash};

fn fnv1a32(text: &str) -> u32 {
    text.encode_utf16().fold(0x811c_9dc5_u32, |hash, unit| {
        (hash ^ u32::from(unit)).wrapping_mul(0x0100_0193)
    })
}

fn manifest_names_sorted() -> Vec<String> {
    let instruments = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../instruments");
    let mut names: Vec<String> = fs::read_dir(instruments)
        .unwrap()
        .map(|entry| entry.unwrap().path().join("manifest.json"))
        .filter(|path| path.is_file())
        .map(|path| {
            let json: serde_json::Value =
                serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
            json["name"].as_str().unwrap().to_owned()
        })
        .collect();
    names.sort();
    names
}

#[test]
fn every_id_exports_the_hash_of_its_manifest_name() {
    let names = manifest_names_sorted();
    assert_eq!(untzel_instrument_count() as usize, names.len());
    for (id, name) in names.iter().enumerate() {
        assert_eq!(
            untzel_instrument_name_hash(id as u32),
            fnv1a32(name),
            "{name}"
        );
    }
}

#[test]
fn a_hyphenated_name_keeps_its_hyphen_in_the_id_and_the_hash() {
    let names = manifest_names_sorted();
    let id = names
        .iter()
        .position(|name| name == "fm-bass")
        .expect("fm-bass exists");
    assert_eq!(untzel_dsp::instruments::INSTRUMENT_NAMES[id], "fm-bass");
    assert_eq!(untzel_instrument_name_hash(id as u32), fnv1a32("fm-bass"));
    assert_eq!(untzel_dsp::instruments::fm_bass::VOICES, 1);
}

#[test]
fn fnv1a32_matches_the_normative_vectors() {
    assert_eq!(fnv1a32("a"), 0xe40c_292c);
    assert_eq!(fnv1a32("kick"), 0xc61c_131f);
    assert_eq!(fnv1a32("hat"), 0xf2bf_17c2);
    assert_eq!(fnv1a32("bass"), 0x53dc_b77a);
}
