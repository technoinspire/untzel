# Cookbook {#cookbook}

Recipes that play as they are, written only with the instruments of this build ([Instruments](instruments.md)). Paste one into the Code panel, let it play, then change one thing at a time.

## A 124 BPM melodic groove {#melodic-groove}

A steady kick, two hat layers and a sub, under a bass melody that walks through four chords of A minor, one per bar. The melody's filter opens and closes over 16 bars with `sine(16)`, and `delay 3/16` with `reverb wide` gives it space. `duck` makes the sub and the melody dip under every kick.

{{example cookbook-melodic-groove}}

Try `swing 0.12` for a looser feel, or `pitch 42` on the kick for a deeper one.

## Rolling bass with duck {#rolling-bass}

The bass plays three sixteenths after every kick and stays out of the kick's way with `duck 0.85`: the higher the value, the deeper it dips when the kick hits. A short `decay` keeps the notes tight.

{{example cookbook-rolling-bass}}

Try `cutoff 1200` for a brighter roll, or change the last three notes of the bar for a different turn.

## Percussion with swing and chance {#percussion}

The global `swing` shuffles every track; the shaker overrides it with its own `swing 0.2`. `x?0.3` on the ghost kick and `x?0.5` inside the shaker group play only some of the time, and `pan rand(2)` moves the shaker to a new place every two bars. The draws are deterministic: the same text always plays the same.

{{example cookbook-percussion}}

Try raising a chance to `x?0.8`, or `[x x?0.5]*4` for a slower shaker.

## Builds with saw {#saw-build}

In a song, a signal starts again at the start of each section, so `saw(4)` in a 4-bar section rises exactly from its first bar to its last. Here the hats open, the roll gets louder and the bass filter climbs until the drop, which starts the cycle again.

{{example cookbook-saw-build}}

Try `build 8` with `saw(8)` for a longer build.

## Two-step drum & bass {#drum-and-bass}

At 174 BPM the kick plays only twice a bar, on the first step and just before the second snare, and the snare lands on beats two and four: the two-step. The hats keep the full speed while the reese holds each note for half a bar or more, so the bass feels half as fast as the drums. `sine(8)` opens and closes its filter over eight bars, and the last snare of the bar, `x?0.5`, plays about half the time.

{{example cookbook-drum-and-bass}}

Try `detune 0.4` for a narrower reese, or move the second kick to `...x` for a different turn.

## A whole song with sections {#full-song}

The groove of the first recipe as a song: an intro, a build, a drop, a break, another build and drop, and an outro. Sections choose which tracks play; the song decides how many bars each lasts. Switch the transport to `Song` to hear it from the start.

{{example cookbook-full-song}}

Try another order in the `song` line, or `| loop` at its end.
