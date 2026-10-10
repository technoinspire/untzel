# SPDX-License-Identifier: CPAL-1.0
# Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
"""VocalSet on Zenodo: the license gate and a ranged download of single members.

The record is checked before any audio is read: if Zenodo does not report
CC BY 4.0 for record 1442513, the pipeline stops. The zip (2 GB) is never
downloaded whole: its central directory and the chosen members are read with HTTP
range requests, and every member is checked against the CRC-32 the zip stores.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import urllib.request
import zipfile
from dataclasses import dataclass
from pathlib import Path

RECORD_ID = 1442513
RECORD_URL = f"https://zenodo.org/api/records/{RECORD_ID}"
# The record (version 1.2) holds two archives, `VocalSet1-2.zip` (6 GB) and
# `VocalSet11.zip` (2 GB); the long tones are read from the smaller one, and every
# manifest names it (see `provenance`).
ARCHIVE = "VocalSet11.zip"
ARCHIVE_URL = f"{RECORD_URL}/files/{ARCHIVE}/content"
REQUIRED_LICENSE = "cc-by-4.0"
DOI = "10.5281/zenodo.1442513"
PAPER = (
    "Julia Wilkins, Prem Seetharaman, Alison Wahl and Bryan Pardo. VocalSet: A Singing "
    "Voice Dataset. In Proceedings of the 19th International Society for Music "
    "Information Retrieval Conference (ISMIR), Paris, 2018."
)
LONG_TONE = re.compile(r"^FULL/(?P<folder>(?:fe)?male\d+)/long_tones/straight/(?P<file>[^/]+_(?P<vowel>[aiu])\.wav)$")


class LicenseRefused(RuntimeError):
    """The record's license is not the one this pipeline was cleared for."""


@dataclass(frozen=True)
class SourceFile:
    """One VocalSet member stored under the cache, with its checksum."""

    member: str
    singer: str
    vowel: str
    path: Path
    sha256: str


def fetch_record() -> dict:
    with urllib.request.urlopen(RECORD_URL) as response:
        return json.load(response)


def verify_license(record: dict) -> str:
    """Returns the license id; raises LicenseRefused unless it is CC BY 4.0."""
    license_id = (record.get("metadata", {}).get("license") or {}).get("id")
    if license_id != REQUIRED_LICENSE:
        raise LicenseRefused(f"record {RECORD_ID} reports license {license_id!r}, not {REQUIRED_LICENSE}")
    return license_id


def provenance(record: dict) -> dict:
    """Where the audio comes from, as the record reports it: its version and the archive read."""
    version = record.get("metadata", {}).get("version")
    archives = [entry.get("key") for entry in record.get("files", [])]
    if not version or ARCHIVE not in archives:
        raise RuntimeError(f"record {RECORD_ID}: version {version!r}, archives {archives}; expected {ARCHIVE}")
    return {
        "dataset": "VocalSet",
        "recordVersion": version,
        "archive": ARCHIVE,
        "record": f"https://zenodo.org/records/{RECORD_ID}",
        "doi": DOI,
        "citation": f"{PAPER} Dataset: https://doi.org/{DOI} (Zenodo record {RECORD_ID}, version {version}, archive {ARCHIVE}).",
    }


class _RangedFile(io.RawIOBase):
    """A read-only file over HTTP range requests, enough for zipfile."""

    def __init__(self, url: str) -> None:
        self._url = url
        self._position = 0
        request = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(request) as response:
            self._size = int(response.headers["Content-Length"])

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    def tell(self) -> int:
        return self._position

    def seek(self, offset: int, whence: int = 0) -> int:
        base = {0: 0, 1: self._position, 2: self._size}[whence]
        self._position = base + offset
        return self._position

    def readinto(self, buffer) -> int:
        if self._position >= self._size or len(buffer) == 0:
            return 0
        end = min(self._size, self._position + len(buffer)) - 1
        request = urllib.request.Request(self._url, headers={"Range": f"bytes={self._position}-{end}"})
        with urllib.request.urlopen(request) as response:
            data = response.read()
        buffer[: len(data)] = data
        self._position += len(data)
        return len(data)


def singer_of(folder: str) -> str:
    """`female9` → `f9`, `male10` → `m10` (the dataset's anonymous ids)."""
    return ("f" if folder.startswith("female") else "m") + re.sub(r"\D", "", folder)


def fetch_long_tones(cache: Path) -> list[SourceFile]:
    """Every straight long tone on a, i and u, from the cache or from the archive."""
    target = cache / "vocalset"
    archive = zipfile.ZipFile(io.BufferedReader(_RangedFile(ARCHIVE_URL), buffer_size=1 << 16))
    files = []
    for info in archive.infolist():
        match = LONG_TONE.match(info.filename)
        if match is None:
            continue
        path = target / info.filename
        if not path.exists() or path.stat().st_size != info.file_size:
            path.parent.mkdir(parents=True, exist_ok=True)
            # ZipFile.read checks the member against its stored CRC-32.
            path.write_bytes(archive.read(info))
        files.append(
            SourceFile(
                member=info.filename,
                singer=singer_of(match["folder"]),
                vowel=match["vowel"],
                path=path,
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            )
        )
    return sorted(files, key=lambda source: source.member)
