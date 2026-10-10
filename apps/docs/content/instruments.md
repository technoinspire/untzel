# Instruments {#instruments}

Every instrument of this build, generated from its manifest: the same file the analyzer, the track detail and the sound engine read. If it is not on this page, the app does not have it.

Each parameter is a modifier of the track: `| cutoff 900`. Its value can be a number inside the range or a signal ([Language guide](language.md#signals)). An exponential curve moves evenly through the octaves of the range, as an ear hears frequency and time. `tone` is the one-finger macro of a tile: from 0 to 1 it moves the parameters listed under each instrument between the two values shown. An explicit parameter in the text wins over `tone`.

Some instruments play recordings. On `piano`, `strings`, `harp`, `mallet`, `bell`, `kalimba` and `choir` the `source` parameter is `samples` by default, and `| source synth` plays the synthesized voice instead; on `vox`, the `ooh` and `aah` sounds play recorded singers. A recording is downloaded only when a track uses it, and until it arrives the synthesized voice plays, so the music never waits ([Credits](credits.md)). The model name next to each instrument is the name the library shows; the word you write in the text is always the one in the heading.

The kind decides what a pattern may contain: drums play hits (`x . ~`), pitched instruments play notes (`c2`), chord instruments play chords (`Cm7`).

{{status instrument-library}}

{{instruments}}
