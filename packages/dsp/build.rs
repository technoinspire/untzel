// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Reads instruments/*/manifest.json, sorts by `name` (str::cmp, equal to the UTF-16
//! code-unit order of createRegistry for ASCII names) and generates, in OUT_DIR:
//! - one module per instrument with parameter index constants, ranges and its voice.rs;
//! - INSTRUMENT_NAMES and INSTRUMENT_NAME_HASHES (fnv1a32 of each name, by instrumentId);
//! - `InstrumentState` (one voice pool per instrument), its static dispatch, and the
//!   manifest ranges by instrumentId.
//!
//! Convention: the voice type of instrument `<name>` is `<Name>Voice` (pascal case) and
//! its module is the name with `-` replaced by `_` (`fm-bass` -> `fm_bass::FmBassVoice`).
//! Every `voice.rs` is checked by `build/voice_paths.rs`.
//!
//! Over 300 lines: the generator of the instrument index; one function per generated item, in the order it is written.

use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;

#[path = "build/voice_paths.rs"]
mod voice_paths;

/// Instruments whose voice predates the engines; the only ones allowed to
/// declare `engine: "legacy"`.
const LEGACY_INSTRUMENTS: [&str; 3] = ["bass", "hat", "kick"];
const ENGINES: [&str; 7] = [
    "va",
    "fm",
    "additive",
    "string",
    "modal",
    "formant",
    "percussion",
];
const MAX_VOICES: u32 = 32;

#[derive(Deserialize)]
struct Manifest {
    name: String,
    voices: u32,
    #[serde(default)]
    engine: Option<String>,
    #[serde(default)]
    allocation: Option<String>,
    #[serde(default)]
    steal: Option<String>,
    parameters: Vec<ManifestParameter>,
}

#[derive(Deserialize)]
struct ManifestParameter {
    name: String,
    #[serde(default)]
    min: f32,
    #[serde(default)]
    max: f32,
    #[serde(default)]
    default: serde_json::Value,
    #[serde(default)]
    choices: Option<Vec<String>>,
}

impl ManifestParameter {
    /// `(min, max, default)` in DSP units: a choice is its index.
    fn range(&self, path: &str) -> (f32, f32, f32) {
        match &self.choices {
            Some(choices) => {
                assert!(
                    (2..=8).contains(&choices.len()),
                    "{path}: a choice parameter has 2 to 8 choices"
                );
                let default = self
                    .default
                    .as_str()
                    .unwrap_or_else(|| panic!("{path}: default must be a choice name"));
                let index = choices
                    .iter()
                    .position(|choice| choice == default)
                    .unwrap_or_else(|| {
                        panic!("{path}: default \"{default}\" is not one of the choices")
                    });
                (0.0, (choices.len() - 1) as f32, index as f32)
            }
            None => {
                let default = self
                    .default
                    .as_f64()
                    .unwrap_or_else(|| panic!("{path}: default must be a number"))
                    as f32;
                assert!(self.max > self.min, "{path}: max must be above min");
                assert!(
                    (self.min..=self.max).contains(&default),
                    "{path}: default outside min..max"
                );
                (self.min, self.max, default)
            }
        }
    }
}

struct Instrument {
    manifest: Manifest,
    voice_path: PathBuf,
}

fn fnv1a32(text: &str) -> u32 {
    text.encode_utf16().fold(0x811c_9dc5_u32, |hash, unit| {
        (hash ^ u32::from(unit)).wrapping_mul(0x0100_0193)
    })
}

fn constant_name(parameter: &str) -> String {
    parameter.to_ascii_uppercase().replace('-', "_")
}

fn module_name(instrument: &str) -> String {
    instrument.replace('-', "_")
}

/// Panics with the manifest path and field on any rule `parseManifest` also enforces.
fn validate(manifest: &Manifest, manifest_path: &Path, voice_path: &Path) {
    let at = manifest_path.display();
    assert!(
        (1..=MAX_VOICES).contains(&manifest.voices),
        "{at}: voices must be 1..{MAX_VOICES}"
    );
    let mono = manifest.allocation.as_deref() == Some("mono");
    assert!(
        matches!(
            manifest.allocation.as_deref(),
            None | Some("poly") | Some("mono")
        ),
        "{at}: allocation must be poly or mono"
    );
    assert!(
        !mono || manifest.voices == 1,
        "{at}: a mono instrument has voices 1"
    );
    assert!(
        matches!(
            manifest.steal.as_deref(),
            None | Some("oldest") | Some("released-quietest")
        ),
        "{at}: steal must be oldest or released-quietest"
    );
    let engine = manifest.engine.as_deref().unwrap_or("legacy");
    let source = fs::read_to_string(voice_path)
        .unwrap_or_else(|_| panic!("{}: missing", voice_path.display()));
    if let Some(problem) = voice_paths::check_voice_paths(&source) {
        panic!("{}: {problem}", voice_path.display());
    }
    if engine == "legacy" {
        assert!(
            LEGACY_INSTRUMENTS.contains(&manifest.name.as_str()),
            "{at}: engine \"legacy\" is reserved for kick, hat and bass"
        );
    } else {
        assert!(
            ENGINES.contains(&engine),
            "{at}: unknown engine \"{engine}\""
        );
        let uses = format!("crate::engines::{engine}");
        let grouped = source.contains("crate::engines::{") && source.contains(engine);
        assert!(
            source.contains(&uses) || grouped,
            "{}: engine \"{engine}\" but the voice does not use {uses}",
            voice_path.display()
        );
    }
    for (index, parameter) in manifest.parameters.iter().enumerate() {
        parameter.range(&format!("{at}: parameters[{index}]"));
    }
}

fn read_instruments(instruments_dir: &Path) -> Vec<Instrument> {
    let mut instruments: Vec<Instrument> = fs::read_dir(instruments_dir)
        .expect("instruments/ must exist")
        .map(|entry| entry.expect("readable instruments/ entry").path())
        .filter(|dir| dir.join("manifest.json").is_file())
        .map(|dir| {
            let manifest_path = dir.join("manifest.json");
            let voice_path = dir.join("voice.rs");
            println!("cargo:rerun-if-changed={}", manifest_path.display());
            println!("cargo:rerun-if-changed={}", voice_path.display());
            let text = fs::read_to_string(&manifest_path).expect("readable manifest.json");
            let manifest: Manifest = serde_json::from_str(&text)
                .unwrap_or_else(|error| panic!("{}: {error}", manifest_path.display()));
            validate(&manifest, &manifest_path, &voice_path);
            Instrument {
                manifest,
                voice_path,
            }
        })
        .collect();
    instruments.sort_by(|a, b| a.manifest.name.cmp(&b.manifest.name));
    for pair in instruments.windows(2) {
        assert!(
            module_name(&pair[0].manifest.name) != module_name(&pair[1].manifest.name),
            "instruments \"{}\" and \"{}\" collide once '-' becomes '_'",
            pair[0].manifest.name,
            pair[1].manifest.name
        );
    }
    instruments
}

fn f32_list(values: impl Iterator<Item = f32>) -> String {
    values
        .map(|value| format!("{value:?}_f32"))
        .collect::<Vec<_>>()
        .join(", ")
}

fn instrument_module(instrument: &Instrument) -> String {
    let manifest = &instrument.manifest;
    let count = manifest.parameters.len();
    let mut out = String::new();
    writeln!(out, "pub mod {} {{", module_name(&manifest.name)).unwrap();
    let ranges: Vec<(f32, f32, f32)> = manifest
        .parameters
        .iter()
        .enumerate()
        .map(|(index, parameter)| {
            parameter.range(&format!("{}: parameters[{index}]", manifest.name))
        })
        .collect();
    for (index, parameter) in manifest.parameters.iter().enumerate() {
        let constant = constant_name(&parameter.name);
        writeln!(out, "    pub const {constant}: usize = {index};").unwrap();
        if let Some(choices) = &parameter.choices {
            writeln!(
                out,
                "    pub const {constant}_CHOICES: usize = {};",
                choices.len()
            )
            .unwrap();
        }
    }
    writeln!(out, "    pub const PARAMETER_COUNT: usize = {count};").unwrap();
    writeln!(out, "    pub const VOICES: usize = {};", manifest.voices).unwrap();
    let mono = manifest.allocation.as_deref() == Some("mono");
    let steal = if manifest.steal.as_deref() == Some("released-quietest") {
        "ReleasedQuietest"
    } else {
        "Oldest"
    };
    writeln!(
        out,
        "    pub const POLICY: crate::pool::Policy = crate::pool::Policy {{ mono: {mono}, steal: crate::pool::Steal::{steal} }};"
    )
    .unwrap();
    let lists = [
        ("PARAMETER_MIN", f32_list(ranges.iter().map(|r| r.0))),
        ("PARAMETER_MAX", f32_list(ranges.iter().map(|r| r.1))),
        ("PARAMETER_DEFAULT", f32_list(ranges.iter().map(|r| r.2))),
    ];
    for (name, values) in lists {
        writeln!(out, "    pub const {name}: [f32; {count}] = [{values}];").unwrap();
    }
    let choices = manifest
        .parameters
        .iter()
        .map(|parameter| parameter.choices.is_some().to_string())
        .collect::<Vec<_>>()
        .join(", ");
    writeln!(
        out,
        "    pub const PARAMETER_IS_CHOICE: [bool; {count}] = [{choices}];"
    )
    .unwrap();
    writeln!(
        out,
        "    #[path = {:?}]",
        instrument.voice_path.display().to_string()
    )
    .unwrap();
    writeln!(out, "    mod voice;").unwrap();
    writeln!(out, "    pub use voice::*;").unwrap();
    writeln!(out, "}}").unwrap();
    out
}

/// `kick` -> `Kick`, `deep-bass` -> `DeepBass`: the variant name and the voice type
/// prefix (`instruments::kick::KickVoice`).
fn pascal_case(name: &str) -> String {
    name.split(['-', '_'])
        .map(|part| {
            let mut chars = part.chars();
            chars
                .next()
                .map(|first| first.to_ascii_uppercase().to_string() + chars.as_str())
                .unwrap_or_default()
        })
        .collect()
}

/// `InstrumentState`: one variant per instrument holding its voice pool, and the static
/// dispatch (no `dyn`) the slot calls from `render`.
fn instrument_state(instruments: &[Instrument]) -> String {
    let variants: Vec<(String, String)> = instruments
        .iter()
        .map(|i| (pascal_case(&i.manifest.name), module_name(&i.manifest.name)))
        .collect();
    let mut out = String::new();
    let max_parameters = instruments
        .iter()
        .map(|i| i.manifest.parameters.len())
        .max()
        .unwrap_or(0);
    writeln!(
        out,
        "pub const MAX_PARAMETER_COUNT: usize = {max_parameters};"
    )
    .unwrap();
    out.push_str(
        "/// One boxed voice pool per instrument: the enum stays small whatever the voice.\n",
    );
    out.push_str("pub enum InstrumentState {\n");
    for (variant, module) in &variants {
        writeln!(
            out,
            "    {variant}(Box<crate::pool::Pool<{module}::{variant}Voice, {{ {module}::VOICES }}>>),"
        )
        .unwrap();
    }
    out.push_str("}\n\n");
    out.push_str("macro_rules! each_pool {\n    ($state:expr, $pool:ident => $body:expr) => {\n        match $state {\n");
    for (variant, _) in &variants {
        writeln!(
            out,
            "            InstrumentState::{variant}($pool) => $body,"
        )
        .unwrap();
    }
    out.push_str("        }\n    };\n}\n\n");
    out.push_str("impl InstrumentState {\n");
    out.push_str("    /// None for an unknown instrument id. Allocates: message handler only.\n");
    out.push_str(
        "    pub fn new(id: usize, sample_rate: f32) -> Option<Self> {\n        match id {\n",
    );
    for (id, (variant, module)) in variants.iter().enumerate() {
        writeln!(
            out,
            "            {id} => Some(InstrumentState::{variant}(Box::new(crate::pool::Pool::new(sample_rate, {module}::POLICY)))),"
        )
        .unwrap();
    }
    out.push_str("            _ => None,\n        }\n    }\n\n");
    out.push_str(
        "    pub fn trigger(&mut self, note: f32, velocity: f32, duration_frames: u32, glide_frames: u32, legato: bool, params: &crate::voice::Params) {\n        each_pool!(self, pool => pool.trigger(note, velocity, duration_frames, glide_frames, legato, params))\n    }\n\n",
    );
    out.push_str(
        "    /// Adds every active voice into `out`; returns the number of active voices.\n    pub fn render(&mut self, out: &mut [f32], params: &crate::voice::Params) -> u32 {\n        each_pool!(self, pool => pool.render(out, params))\n    }\n\n    /// Adds the mid signal into `out` and the side signal of wide voices into `side`.\n    pub fn render_mid_side(&mut self, out: &mut [f32], side: &mut [f32], params: &crate::voice::Params) -> u32 {\n        each_pool!(self, pool => pool.render_mid_side(out, side, params))\n    }\n\n",
    );
    out.push_str(
        "    /// `render` of a stereo instrument (`Voice::STEREO`).\n    pub fn render_stereo(&mut self, left: &mut [f32], right: &mut [f32], params: &crate::voice::Params) -> u32 {\n        each_pool!(self, pool => pool.render_stereo(left, right, params))\n    }\n\n",
    );
    out.push_str(
        "    /// Whether the voices render stereo.\n    pub fn is_stereo(&self) -> bool {\n        each_pool!(self, pool => pool.is_stereo())\n    }\n\n",
    );
    out.push_str(
        "    /// The sample pack the next notes play (sample-based voices; others ignore it).\n    pub fn use_samples(&mut self, pack: Option<&'static crate::engines::sampler::SamplePack>) {\n        each_pool!(self, pool => pool.use_samples(pack))\n    }\n\n",
    );
    out.push_str(
        "    /// Silences every voice and clears its state in place (no allocation).\n    pub fn reset(&mut self) {\n        each_pool!(self, pool => pool.reset())\n    }\n\n",
    );
    out.push_str(
        "    /// CPU protection: at most `max_voices` sound (0 = no cap).\n    pub fn set_voice_limit(&mut self, max_voices: usize) {\n        each_pool!(self, pool => pool.set_limit(max_voices))\n    }\n}\n\n",
    );
    out.push_str("/// Manifest ranges and defaults of an instrument, by local parameter index.\n");
    out.push_str("pub fn parameter_ranges(id: usize) -> Option<crate::params::ParameterRanges> {\n    match id {\n");
    for (id, (_, module)) in variants.iter().enumerate() {
        writeln!(
            out,
            "        {id} => Some(crate::params::ParameterRanges {{ min: &{module}::PARAMETER_MIN, max: &{module}::PARAMETER_MAX, default: &{module}::PARAMETER_DEFAULT, is_choice: &{module}::PARAMETER_IS_CHOICE }}),"
        )
        .unwrap();
    }
    out.push_str("        _ => None,\n    }\n}\n\n");
    out.push_str("/// Voices of an instrument (the manifest `voices`).\n");
    out.push_str("pub fn voice_count(id: usize) -> usize {\n    match id {\n");
    for (id, (_, module)) in variants.iter().enumerate() {
        writeln!(out, "        {id} => {module}::VOICES,").unwrap();
    }
    out.push_str("        _ => 0,\n    }\n}\n");
    out
}

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let instruments_dir = manifest_dir.join("../../instruments");
    println!("cargo:rerun-if-changed={}", instruments_dir.display());
    println!("cargo:rerun-if-changed=build/voice_paths.rs");
    let instruments = read_instruments(&instruments_dir);
    let count = instruments.len();

    let names = instruments
        .iter()
        .map(|i| format!("{:?}", i.manifest.name))
        .collect::<Vec<_>>()
        .join(", ");
    let hashes = instruments
        .iter()
        .map(|i| format!("0x{:08x}", fnv1a32(&i.manifest.name)))
        .collect::<Vec<_>>()
        .join(", ");

    let mut out = String::from("// Generated by packages/dsp/build.rs. Do not edit.\n");
    writeln!(out, "pub const INSTRUMENT_COUNT: usize = {count};").unwrap();
    writeln!(
        out,
        "pub const INSTRUMENT_NAMES: [&str; {count}] = [{names}];"
    )
    .unwrap();
    writeln!(
        out,
        "pub const INSTRUMENT_NAME_HASHES: [u32; {count}] = [{hashes}];"
    )
    .unwrap();
    for instrument in &instruments {
        out.push_str(&instrument_module(instrument));
    }
    out.push_str(&instrument_state(&instruments));

    let out_path = PathBuf::from(env::var("OUT_DIR").unwrap()).join("instruments.rs");
    fs::write(out_path, out).expect("writable OUT_DIR");
}
