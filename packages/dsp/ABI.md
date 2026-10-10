# untzel_dsp.wasm ABI

Contract between `packages/dsp` (Rust, `src/abi.rs` and `src/samples/abi.rs`) and the worklet
(`packages/audio/src/worklet/dsp-exports.ts`). The three files change together, in the
same commit.

## Rules

- Built with `cargo build --release --target wasm32-unknown-unknown -p untzel-dsp`, through
  `scripts/build-wasm.mjs`, which remaps the repository root to `untzel` so the module
  carries no path of the build machine. No `wasm-bindgen`, no `wasm-pack`.
- The module **imports nothing**. It is instantiated with
  `new WebAssembly.Instance(module, {})`.
- Only `u32`, `f32` and `f64` cross the boundary. No strings, no pointers in arguments.
- Frames are `f64`: exact integers up to 2^53.
- One global engine per WASM instance; each worklet has its own instance.
- "Allocates" functions run only in the constructor or the message handler, never in
  `process()`. `untzel_render` never allocates.
- Exported memory: `memory`. When `memory.buffer` changes (growth), the worklet
  recreates its views in the message handler.

## Functions

| Function | Returns | Allocates | Called in |
|---|---|---|---|
| `untzel_engine_new(sample_rate: f32)` | `u32`: 0 ok, 1 already created or invalid rate | yes | constructor |
| `untzel_instrument_count()` | `u32` | no | constructor |
| `untzel_instrument_name_hash(id: u32)` | `u32`: fnv1a32 of the name, 0 for an unknown id | no | constructor |
| `untzel_instance_create(instrument_id: u32)` | `u32` slot, or `u32::MAX` for an unknown id (JS reads -1) | yes | handler |
| `untzel_param_set(slot: u32, param: u32, value: f32)` | — | no | handler |
| `untzel_instance_activate(slot: u32, at_frame: f64)` | — | no | handler |
| `untzel_instance_retire(slot: u32, at_frame: f64)` | — | no | handler |
| `untzel_collect()` | `u32`: slots freed | frees | handler |
| `untzel_event_push(slot: u32, frame: f64, duration: f64, note: f32, velocity: f32)` | `u32`: 0 ok, 1 queue full | no | handler |
| `untzel_param_push(slot: u32, param: u32, frame: f64, value: f32, ramp: u32)` | `u32`: 0 ok, 1 queue full | no | handler |
| `untzel_tempo(bpm: f64, at_frame: f64)` | — | no | handler |
| `untzel_master_gain(value: f32)` | — | no | handler |
| `untzel_stop(at_frame: f64)` | — | no | handler |
| `untzel_render(frame: f64, frames: u32)` | — | **no** | `process()` |
| `untzel_output_ptr()` | `u32` byte offset | no | constructor and handler |
| `untzel_stats_ptr()` | `u32` byte offset | no | constructor and handler |
| `untzel_stats_len()` | `u32` length in `f64` cells | no | constructor and handler |
| `untzel_voice_limit(slot: u32, max_voices: u32)` | `u32`: 0 applied, 1 refused | no | handler |
| `untzel_slot_levels(slot: u32)` | `u32`: 0 applied, 1 refused | no | handler |
| `untzel_levels_ptr()` | `u32` byte offset of 3 `f64` | no | handler |
| `untzel_effect_order(slot: u32, position: u32, kind: u32)` | `u32`: 0 applied, 1 refused | no | handler |
| `untzel_effects_commit(slot: u32, count: u32, at_frame: f64)` | `u32`: 0 applied, 1 refused | no | handler |
| `untzel_modulator_set(slot: u32, param: u32, shape: u32, curve: u32, period_frames: f64, origin_frame: f64, low: f32, high: f32)` | `u32`: 0 applied, 1 refused | no | handler |
| `untzel_envelope_set(slot: u32, param: u32, curve: u32, seconds: f32, from: f32, to: f32)` | `u32`: 0 applied, 1 refused | no | handler |
| `untzel_modulator_clear(slot: u32, param: u32)` | `u32`: 0 applied, 1 refused | no | handler |
| `untzel_samples_reserve(instrument_id: u32, frames: u32, zones: u32, sample_rate: f32)` | `u32`: 0 applied, 1 refused | yes | handler |
| `untzel_samples_pcm_ptr()` | `u32` byte offset of `frames` `i16`, 0 without a reserve | no | handler |
| `untzel_samples_zones_ptr()` | `u32` byte offset of `zones` × 8 `f64`, 0 without a reserve | no | handler |
| `untzel_samples_commit(at_frame: f64)` | `u32`: 0 applied, 1 refused | yes | handler |

Arguments:

- `param`: DSP parameter index. General 0..9 (`gain`, `pan`, `reverbSend`,
  `reverbSpace`, `delaySend`, `delayDivision`, `duck`, `glide`, `legato`, `audible`),
  10..15 reserved, insert effects 16..31 (`lowpass`, `lowpass-q`, `highpass`, `highpass-q`,
  `distort`, `crush`, `chorus`, `chorus-rate`, `phaser`, `phaser-rate`, `eq-low`,
  `eq-mid`, `eq-mid-freq`, `eq-high`, `comp`, `gate`), instrument parameters from 32 in
  manifest order. `value` is in parameter units; a choice parameter (`wave`) is the
  index of the choice and never ramps.
- `audible` (9): 1 sounds (default), 0 is silent. It multiplies `gain` in the mix, the
  sidechain and the meters, after any modulator on `gain`, and is never a modulation
  target. The session's solo writes it; the text never does.
- `kind` of an effect: 0 `lowpass`, 1 `highpass`, 2 `distort`, 3 `crush`, 4 `chorus`,
  5 `phaser`, 6 `eq`, 7 `comp`, 8 `gate`. `position` 0..8, `count` 0..9.
- `shape`: 0 sine, 1 triangle, 2 saw, 3 square. `curve`: 0 linear, 1 exponential (both
  bounds must then be above 0).
- `note`: midi (`c4` = 60), or -1 for a hit. A chord arrives as one event per note.
- `velocity`: 0..1.
- `ramp`: frames. Immediate changes use `round(0.020 × sampleRate)`.
- `instrument_id`: position of the name in the registry sorted by name
  (`build.rs` and `createRegistry` sort the same way).

## Sample packs

`vox` and `choir` read a recorded pack.
The worklet copies a decoded pack in three calls, all in the message handler:

1. `untzel_samples_reserve` allocates the PCM (`frames` mono `i16` at `sample_rate`) and
   the zone table for `instrument_id`. Refused for an unknown instrument, an instrument
   that already has a pack (one per instrument, no unload), `frames` outside
   1..2^24, `zones` outside 1..512 or a rate outside 8 000..384 000 Hz. A new reserve
   drops an upload that was not committed. Memory may grow: recreate the views.
2. The worklet writes the PCM at `untzel_samples_pcm_ptr()` and the zones at
   `untzel_samples_zones_ptr()`, 8 `f64` per zone:

   | Cell | Content |
   |---|---|
   | 0 | vowel position 0 (aah) .. 1 (ooh) on the `vowel` axis |
   | 1, 2 | `lowest`, `highest`: notes `lowest <= note < highest` (midi) use the zone |
   | 3 | `root`: pitch of the recording (midi, fractional) |
   | 4, 5, 6 | `start`, `loopStart`, `loopEnd` (exclusive): whole frames of the PCM, `start < loopStart < loopEnd`, the loop at least 4 frames |
   | 7 | `pan` −1..1: the stem's place in the stereo spread |

3. `untzel_samples_commit(at_frame)` checks every zone (finite, in range, in order,
   inside the PCM) and refuses the whole pack, dropping the upload, if one is bad.
   Applied, the pack reaches the instrument's slots at `at_frame`: a note that starts
   at or after it plays the samples, a note already sounding finishes on its engine
   (no click). A slot created later starts with the pack. The worklet passes the next
   bar, or the current frame when nothing plays.

A committed pack is never freed (it lives as long as the instance). Without a pack, or
with `source synth`, `vox` and `choir` sing on the formant engine, bit-identical to
before the packs existed.

## Memory layout

Output, at `untzel_output_ptr()`: 256 `f32`, planar. `[0, 128)` left, `[128, 256)`
right. `untzel_render(frame, frames)` writes the first `frames` samples of each half.

Stats, at `untzel_stats_ptr()`, `untzel_stats_len()` cells of `f64`:

| Cell | Content | Written by |
|---|---|---|
| 0 | `lateDrops` | DSP |
| 1 | `queueDrops` | DSP |
| 2 | `nanResets` | DSP |
| 3 | `unknownMessages` | worklet (JS), reserved here so one copy carries every counter |
| 4 | `unknownTargets` | worklet (JS), same |
| 5 | `slotCapacity`: number of slot records that follow | DSP |
| 6 + 4·s | `activeVoices` of slot `s` | DSP, in `render` |
| 7 + 4·s | `onsetCount` of slot `s` | DSP, in `render` |
| 8 + 4·s | `lastOnsetFrame` of slot `s` | DSP, in `render` |
| 9 + 4·s | `voiceFrames` of slot `s`: sum of `activeVoices × frames` over every render | DSP, in `render` |

The block grows with the slots, only in the handler; `untzel_stats_ptr()` may change
after `untzel_instance_create`.

## Behaviour the worklet can rely on

No signature of the first ABI changed; the instrument library and the sample packs only
added functions.

- `untzel_engine_new` accepts 8 000..384 000 Hz; anything else (or NaN) returns 1.
- Before `untzel_engine_new`, every function is a no-op that returns its neutral value
  (`NO_SLOT`, 0, `PUSH_OK`, pointer 0).
- `untzel_instance_create` reuses the index of a slot freed by `untzel_collect`; its
  stats record restarts at zero. Freed slots read as zero in the stats block.
- A slot takes events only while `Active` (`activate_at <= frame < retire_at`). Events
  for an unknown or freed slot, or with a non-finite frame, are ignored and return 0.
- Values are clamped to the manifest range (general parameters: `gain` 0..4 (the text writes 0..1; above 1 is the tone level correction), `pan`
  −1..1, sends and `duck` 0..1, `reverbSpace` rounded to 0..6 — `small`, `wide`, `sea`, `room`, `plate`, `hall`, `dub` — and `delayDivision` rounded to 0..2).
  Non-finite values and indices 7..15 or past the instrument's parameters are ignored.
- Queue capacities: 8 192 events, 4 096 parameter points, 64 tempo changes. A rejected
  push also adds 1 to `queueDrops`.
- `lastOnsetFrame` is the frame the voice started (the block start for a late event).
  The audio of that onset leaves the output **`round(0.001 × sampleRate)` frames
  later** (limiter lookahead: 48 at 48 kHz, 44 at 44.1 kHz), the same for every slot.
- `activeVoices` is written by every `untzel_render`. `voiceFrames` only grows (it
  restarts at zero when the slot index is reused); the difference of two readings
  divided by the frames between them is the average number of sounding voices, which,
  with `costPerVoice`, is the input of the load estimate.
- After `untzel_stop(at)`: events and points at or after `at` are dropped; the master
  fades linearly to 0 over `round(0.020 × sampleRate)` frames from `at`; then voices and
  filters reset and the effect memory is zeroed 65 536 samples per block (silent output
  meanwhile, about 10 blocks at 48 kHz). Events pushed for the next play wait and start
  on their frame once the clear ends.
- `untzel_voice_limit`: `max_voices = 0` means no cap. With a cap, a new note steals by
  the instrument's policy among the active voices, and voices above a lowered cap fade
  out in about 2 ms, quietest first.
- `untzel_slot_levels` copies `[sumSquares, frames, peak]` of the slot's output after
  `gain`, before `pan` and sends (`(L + R) ÷ 2` with effects), and restarts the sums.
- Insert chain: `untzel_effect_order` writes the pending order and
  `untzel_effects_commit` makes the first `count` entries the chain at `at_frame`.
  Entering fades from dry in 20 ms, leaving fades to dry in 20 ms and a new order goes
  dry → new in 40 ms. A repeated kind refuses the whole commit and keeps the current
  chain. With no effect the slot is mono and bit-identical to the plain mono path (the
  voices straight into `gain`, `duck`, `pan` and the sends); with effects it is
  stereo and `pan` acts as a balance with the same law. Peak, silence and retirement
  read the chain's output, so tails (chorus) finish before the slot does.
- Modulators: at most 8 per slot, one per parameter, on `gain`, `pan`, effect and
  instrument parameters only (never on sends, `duck`, `glide`, `legato` or a choice).
  While a modulator drives an index, `untzel_param_set` and `untzel_param_push` on it
  are **ignored**; `untzel_modulator_clear` gives it back, from the current value. The
  LFO phase is `frac((frame − origin_frame) / period_frames)`; the value is
  `low + (high − low)·x` or `low·(high/low)^x`, recomputed every 32 frames with a linear
  ramp between. An envelope jumps to `from` on every note and reaches `to` (99%) in
  `seconds`.
- Refusals (1) change nothing. The DSP never writes cell 4: the worklet adds every
  refusal to `unknownTargets`.
- The output never exceeds −1 dBFS (limiter ceiling with a final clamp) and is always
  finite: a slot that produces a non-finite sample is reset and counted in `nanResets`.
