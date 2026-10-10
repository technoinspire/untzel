// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! A voice may only reach `crate::voice`, `crate::math`, `crate::engines` and its
//! own generated constants. The check is the one `build.rs` runs.

#[path = "../build/voice_paths.rs"]
mod voice_paths;

use voice_paths::check_voice_paths;

#[test]
fn a_voice_reaching_into_the_slot_is_refused() {
    let source = include_str!("fixtures/forbidden_voice.rs");
    let problem = check_voice_paths(source).expect("refused");
    assert!(problem.contains("crate::slot"), "{problem}");
    assert!(problem.starts_with("line "), "{problem}");
}

#[test]
fn every_real_voice_is_clean() {
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../instruments");
    for entry in std::fs::read_dir(dir).unwrap() {
        let path = entry.unwrap().path().join("voice.rs");
        if path.is_file() {
            let source = std::fs::read_to_string(&path).unwrap();
            assert_eq!(check_voice_paths(&source), None, "{}", path.display());
        }
    }
}

#[test]
fn comments_and_strings_do_not_count() {
    let source = "// crate::slot::BLOCK in a comment\nconst A: &str = \"crate::engine\";\nuse crate::math::sine;\n";
    assert_eq!(check_voice_paths(source), None);
    assert!(check_voice_paths("use std::vec::Vec;").is_some());
    assert!(check_voice_paths("mod sneaky;").is_some());
    assert!(check_voice_paths("let x = super::helper();").is_some());
    assert_eq!(check_voice_paths("let x = super::CUTOFF;"), None);
}
