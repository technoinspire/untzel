# Language guide {#language}

Untzel code is a small, closed language for music. It is analyzed, never executed: there are no functions, variables, loops or imports, so the same text always plays the same music, in the app and anywhere else it is opened. Keywords, instrument names, parameters and error codes are in English; the app shows each error message in its own language.

Every example on this page plays as it is. Copy it, paste it into the Code panel and change it.

## The structure of a text {#structure}

A text has four parts, in this order, and every part is optional:

1. globals: `title`, `tempo`, `key`, `swing` and `loop`;
2. tracks, one per line;
3. sections, with `section`;
4. at most one `song`.

Empty lines are ignored and `//` starts a comment that runs to the end of the line.

{{example structure}}

Without a `song`, every track that is not muted plays in a loop.

## Tempo, key, swing and loop {#globals}

`tempo` sets the beats per minute, from {{limit MIN_TEMPO}} to {{limit MAX_TEMPO}}; without it the text plays at {{limit DEFAULT_TEMPO}}. A value outside the range is an error, never a silent correction.

`key` takes a tonic, `a` to `g` with an optional `b` or `#`, and a scale: `minor`, `major`, `dorian`, `phrygian` or `chromatic`. Without it the key is `c minor`.

`swing` delays the even eighths, from 0 up to {{limit MAX_SWING}}. Each global can appear once.

{{example globals}}

### Loop length {#loop-length}

`loop` sets how many bars one pass of Loop mode lasts, a whole number from {{limit MIN_LOOP_BARS}} to {{limit MAX_LOOP_BARS}}. On every pass all patterns and signals start again from bar 1: a 2-bar pattern plays 4 times in `loop 8`, and a pattern longer than the loop plays only its first bars. Without `loop`, every pattern repeats on its own length, as before.

{{example loop-length}}

A new length enters on the next bar and the music never stops. Song mode ignores `loop`: there the sections and the `song` line decide. `loop` is still a valid track name and the word at the end of `song … | loop`. The **Length** chip of the transport writes this line for you ([Using the app](app.md#loop-length)).

### Song title {#title}
`title "Midnight Coast"` names the song: up to 60 characters between double quotes, where `\"` writes a quote and `\\` a backslash. It never changes the sound. The app shows it in the top bar and in the browser tab, and it goes into the file names, the exported video and the shared link. Renaming the song in the app writes this line ([Using the app](app.md#projects)). An empty title or one longer than 60 characters is a warning, not an error: the music keeps playing, without a title or with its first 60 characters. A second `title` line is an error, like a second `tempo`. `title` is still a valid track name.

{{example title}}

## Tracks with names {#tracks}

A track line is an optional name and a colon, an instrument, a pattern, and modifiers after `|`. The name is how sections, tiles and messages refer to the track. Names are lower case, start with a letter, and have at most {{limit MAX_NAME_LENGTH}} characters.

Two tracks can use the same instrument with different patterns and sounds: each track is an independent instance. A track without a name takes the instrument's name, or the next free number.

{{example named-tracks}}

The order of the lines is the order of the tracks on screen.

## Patterns: the mini-notation {#mini-notation}

A pattern describes one bar; `/` separates the bars of a longer pattern, which repeats when it ends. The steps of a bar divide it equally.

| Write | Means |
|---|---|
| `x` `X` `.` | a hit, an accented hit, a rest. In a run like `x...` every character is a step |
| `~` | holds the previous step one step longer: `x~~~` holds a hit for four steps |
| `c2` `eb2` `f#1` | a note with its octave, for instruments that play notes |
| `[x x]` | a group: subdivides one step |
| `x?` `x?0.3` | plays with a chance; without a number the chance is {{limit DEFAULT_PROBABILITY}} |
| `x*4` `[c2 g1]*2` | repeats inside the same step |
| `/` | the next bar of the pattern |

{{example mini-notation}}

### Counting steps {#steps}

Spaces separate elements, but in a run of hits each character is already a step, so `x... x...` and `x...x...` are the same eight steps. `x... x... x... x...` is a bar of 16 steps, each a sixteenth; `c2 . eb2 c3 . c2 g1 .` is 8 steps, each an eighth. A bar has at most {{limit MAX_STEPS_PER_BAR}} steps and groups nest at most {{limit MAX_GROUP_DEPTH}} deep.

## Notes and chords {#notes}

Instruments that play notes take lower-case note names with an octave: `c1`, `eb2`, `f#1`. A `.` is a rest and `~` holds the note.

{{example notes}}

Notes joined by `+` sound together in one step, as a stack you voice yourself: `c3+eb3+g3`. A `!` after a hit or a note accents it, like `X` on a drum.

{{example stacks-and-accents}}

Chord names start with a capital letter, as in `Cm7`, `Abmaj7` or `Gsus4`, and need an instrument of kind chord. Writing a chord for an instrument that plays notes is the error `PATTERN_KIND_MISMATCH` ([reference](reference.md#error-pattern-kind-mismatch)).

{{status chords}}

## The scale lock {#scale-lock}

With a key, every note outside the scale moves to the nearest degree of it, so a wrong note is impossible. `| free` turns the lock off for one track, and `key c chromatic` turns it off for the whole text.

{{example scale-lock}}

## Modifiers {#modifiers}

Modifiers come after the pattern, each after a `|`, and are read from left to right. If the same modifier appears twice, the last one wins and the earlier one gets the warning `DUPLICATE_MODIFIER`; a warning never stops the music.

There are general modifiers every track accepts (`gain`, `pan`, `tone`, `reverb`, `delay`, `duck`, `transpose`, `swing`, `shift`, `mute`, `free`) and the parameters of each instrument, such as `cutoff` on `bass` or `open` on `hat`. The full table with every range is in the [reference](reference.md#general-modifiers), and every instrument parameter is on the [Instruments](instruments.md) page.

{{example modifiers}}

When `tone` and a parameter it moves appear together, the explicit parameter wins.

## Signals {#signals}

Any numeric parameter that allows it can take a slow wave instead of a number: a shape, a period in bars and a range. The range is required and stays inside the parameter's limits; the period is at most {{limit MAX_SIGNAL_PERIOD}} bars.

| Shape | Moves |
|---|---|
| `sine(8)` | smoothly up and down |
| `tri(4)` | in straight lines up and down |
| `saw(4)` | up, then starts again |
| `square(2)` | between the two ends |
| `rand(1)` | to a new value every period, the same on every play |

{{example signals}}

In a song, a signal starts again at the start of every section, so `saw(4)` in a 4-bar section rises exactly across it ([Cookbook](cookbook.md#saw-build)).

## Sections and the song {#sections}

`section` names a set of tracks that play together; a track can be in as many sections as you like. A section can change the `tempo` from its start and the `gain` of all its tracks. `song` plays sections in order, each for a number of bars, from {{limit MIN_PART_BARS}} to {{limit MAX_PART_BARS}}; the same section can come back.

{{example sections-and-song}}

### Looping the song {#song-loop}

A song stops at its end. With `| loop` at the end of the `song` line it starts again.

{{example song-loop}}

### Sections without a song {#sections-without-song}

{{example sections-without-song}}

## Loop and Song modes {#modes}

The mode is not written in the text: it is a switch of the transport, like play and stop. In Loop mode every track without `mute` plays forever, in passes of `loop <bars>` when the text has it, and sections are ignored. In Song mode the parts play in order; with sections but no song, each section plays 8 bars in order, in a cycle. `mute` silences a track in both modes, even inside a section. The play range is not written either: choosing which bars or parts repeat changes how you play, never the text ([Using the app](app.md#play-range)).

## Limits {#limits}

The language has no limit on tracks, tracks per instrument, sections or song parts; the device does, and the CPU meter shows how much is in use. The fixed limits protect the analyzer and keep a text readable: a text has at most {{limit MAX_SOURCE_LENGTH}} characters, a pattern at most {{limit MAX_BARS_PER_PATTERN}} bars. Every limit is in the [reference](reference.md#limits).

## Determinism {#determinism}

Chance (`?`) and `rand` are drawn from a seed made of the text itself, the track name and the bar. The same text plays the same notes every time, on every device. Change one character of the text and the draw changes; the `title` line is the exception, so renaming a song never changes what it plays.
