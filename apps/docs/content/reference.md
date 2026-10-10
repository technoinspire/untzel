# Language reference {#reference}

The complete language on one page: order, statements, values, every modifier, every limit, the grammar and every error with its message and fix. Numbers in the tables come from the analyzer of this build. The [guide](language.md) explains the same things with examples.

## Order of a text {#order}

Globals, then tracks, then sections, then the song. Each global (`title`, `tempo`, `key`, `swing`, `loop`) at most once, and at most one `song`. Text out of this order is the error `OUT_OF_ORDER`.

| Statement | Form |
|---|---|
| title | `title "<text>"`, up to 60 characters; `\"` writes a quote and `\\` a backslash |
| tempo | `tempo <bpm>` |
| key | `key <tonic> <scale>`, tonic `a` to `g` with optional `b` or `#`; scale `minor`, `major`, `dorian`, `phrygian` or `chromatic` |
| swing | `swing <amount>` |
| loop | `loop <bars>`, a whole number |
| track | `[<name>:] <instrument> <pattern> ( \| <modifier> [value] )*` |
| section | `section <name> <track> <track>... ( \| tempo <bpm> ) ( \| gain <value> )` |
| song | `song <section> <bars>, <section> <bars>... [ \| loop ]` |

Tempo goes from {{limit MIN_TEMPO}} to {{limit MAX_TEMPO}} with {{limit DEFAULT_TEMPO}} as default; swing from 0 to {{limit MAX_SWING}}; loop from {{limit MIN_LOOP_BARS}} to {{limit MAX_LOOP_BARS}} bars, absent by default; the default key is `c minor`.

## Names {#names}

Track and section names follow `[a-z][a-z0-9_-]*`, at most {{limit MAX_NAME_LENGTH}} characters, unique among tracks and unique among sections. A track without a name takes the instrument's name, or `<instrument><n>` with the next free number from 2: explicit names are reserved first, then unnamed tracks are numbered in text order. Only repeated explicit names are the error `DUPLICATE_TRACK_NAME`.

## Pattern elements {#patterns}

| Element | Example | Meaning |
|---|---|---|
| hits | `x...`, `X.x~` | each character a step: hit, accent, rest, hold |
| note | `c2`, `eb2`, `f#1` | lower case, optional `b` or `#`, octave digit |
| chord | `Cm7`, `Abmaj7` | capital root, optional `b` or `#`, quality `m`, `7`, `m7`, `maj7`, `sus2`, `sus4` or `dim` (none is major) |
| rest | `.` | one silent step |
| hold | `~` | the previous element one step longer |
| group | `[x x]` | subdivides one step; nests at most {{limit MAX_GROUP_DEPTH}} deep |
| chance | `x?`, `c2?0.3` | plays with that chance, {{limit DEFAULT_PROBABILITY}} without a number |
| repeat | `x*4` | whole number from {{limit MIN_REPEAT}} to {{limit MAX_REPEAT}}, inside the same step |
| bar | `/` | the next bar of the pattern |

Drum instruments play hits, pitched instruments play notes, chord instruments play chords; anything else is `PATTERN_KIND_MISMATCH`.

## General modifiers {#general-modifiers}

Every track accepts these, whatever its instrument. The parameters of each instrument are on the [Instruments](instruments.md) page.

{{general-modifiers}}

`reverb` and `delay` send to shared buses: the reverb spaces named in the table and three delay lines. The spaces are presets of an algorithmic reverb, not recordings of places.

## Section modifiers {#section-modifiers}

{{section-modifiers}}

## Values and signals {#values}

A value is a number, a name (`sea`), a division (`3/16`) or a signal with a range: `sine(8) 300..2400`. Signal shapes are `sine`, `tri`, `saw`, `square` and `rand`. The range is required and must fit the parameter; the period is above 0 and at most {{limit MAX_SIGNAL_PERIOD}} bars. A signal restarts at the start of each section of a song.

## When changes play {#timing}

A change to a constant number plays immediately. Every other change, structural, waits for the next bar not yet scheduled. In Song mode, a queued part and a mode switch wait for the next 4-bar phrase.

## Limits {#limits}

{{limits}}

## Grammar {#grammar}

The normative grammar is the Lezer grammar the app's parser is generated from. Keywords extend names, so `sine:` and `loop:` are still valid track names, and a track without a pattern parses and then fails with `EMPTY_PATTERN`.

{{grammar}}

## Errors {#errors}

Analysis never throws: it returns the program or a list of diagnostics, each with a position, a stable code and a message, which the app shows in its language (the English text is the source). Syntax errors give one diagnostic per line. The codes are a stable contract; the messages may change. The messages below are the ones the app shows today in English; the Portuguese page shows the Portuguese ones.

{{diagnostics}}
