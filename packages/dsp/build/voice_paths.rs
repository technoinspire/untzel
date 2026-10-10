// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

//! Isolation of instrument voices: a `voice.rs` may
//! only reach `crate::voice`, `crate::math`, `crate::engines` and the constants
//! generated from its own manifest (`super::NAME`). Shared by `build.rs` and by the
//! test `tests/voice_paths.rs` (through `#[path]`).

/// Removes `//` and `/* */` comments, string and char literals, keeping line breaks so
/// that line numbers stay right.
pub fn strip_comments_and_literals(source: &str) -> String {
    let bytes = source.as_bytes();
    let mut out = String::with_capacity(source.len());
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i];
        let next = bytes.get(i + 1).copied();
        if c == b'/' && next == Some(b'/') {
            while i < bytes.len() && bytes[i] != b'\n' {
                i += 1;
            }
        } else if c == b'/' && next == Some(b'*') {
            i += 2;
            while i < bytes.len() && !(bytes[i] == b'*' && bytes.get(i + 1) == Some(&b'/')) {
                if bytes[i] == b'\n' {
                    out.push('\n');
                }
                i += 1;
            }
            i += 2;
        } else if c == b'"' {
            i += 1;
            while i < bytes.len() && bytes[i] != b'"' {
                if bytes[i] == b'\\' {
                    i += 1;
                }
                if bytes.get(i) == Some(&b'\n') {
                    out.push('\n');
                }
                i += 1;
            }
            i += 1;
            out.push_str("\"\"");
        } else if c == b'\'' && bytes.get(i + 2) == Some(&b'\'') {
            i += 3;
            out.push_str("' '");
        } else {
            out.push(c as char);
            i += 1;
        }
    }
    out
}

fn is_ident(c: u8) -> bool {
    c.is_ascii_alphanumeric() || c == b'_'
}

/// First forbidden path of a voice, as `line N: message`, or None when it is clean.
pub fn check_voice_paths(source: &str) -> Option<String> {
    let code = strip_comments_and_literals(source);
    for (number, line) in code.lines().enumerate() {
        let line_number = number + 1;
        let trimmed = line.trim_start();
        for forbidden in [
            "extern crate",
            "include!",
            "#[path",
            "mod ",
            "std::",
            "alloc::",
        ] {
            let starts_item = forbidden == "mod "
                && (trimmed.starts_with("mod ") || trimmed.starts_with("pub mod "));
            if (forbidden != "mod " && contains_token(line, forbidden)) || starts_item {
                return Some(format!(
                    "line {line_number}: `{}` is not allowed in a voice",
                    forbidden.trim()
                ));
            }
        }
        if let Some(message) = check_prefixed(line, "crate::", |rest| {
            ["voice", "math", "engines"].iter().any(|module| {
                rest.starts_with(module)
                    && !rest
                        .as_bytes()
                        .get(module.len())
                        .copied()
                        .is_some_and(is_ident)
            })
        }) {
            return Some(format!("line {line_number}: {message}"));
        }
        if let Some(message) = check_prefixed(line, "super::", |rest| {
            let name: String = rest
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || *c == '_')
                .collect();
            !name.is_empty()
                && name.chars().next().is_some_and(|c| c.is_ascii_uppercase())
                && name
                    .chars()
                    .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit() || c == '_')
        }) {
            return Some(format!("line {line_number}: {message}"));
        }
    }
    None
}

fn contains_token(line: &str, token: &str) -> bool {
    line.match_indices(token)
        .any(|(at, _)| at == 0 || !is_ident(line.as_bytes()[at - 1]))
}

fn check_prefixed(line: &str, prefix: &str, allowed: impl Fn(&str) -> bool) -> Option<String> {
    for (at, _) in line.match_indices(prefix) {
        if at > 0 && is_ident(line.as_bytes()[at - 1]) {
            continue;
        }
        let rest = &line[at + prefix.len()..];
        if let Some(group) = rest.strip_prefix('{') {
            // `use crate::{math::x, voice::y}`: check every group member.
            let inner: String = group.chars().take_while(|&c| c != '}').collect();
            for member in inner.split(',').map(str::trim).filter(|m| !m.is_empty()) {
                if !allowed(member) {
                    return Some(format!(
                        "`{prefix}{member}` is outside crate::voice, crate::math and crate::engines"
                    ));
                }
            }
            continue;
        }
        if !allowed(rest) {
            let shown: String = rest
                .chars()
                .take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == ':')
                .collect();
            return Some(format!("`{prefix}{shown}` is outside what a voice may use"));
        }
    }
    None
}
