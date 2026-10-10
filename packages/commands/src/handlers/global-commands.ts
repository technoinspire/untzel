// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { MAX_LOOP_BARS, MIN_LOOP_BARS } from "@untzel/core";
import { MAX_TEMPO, MIN_TEMPO, printNumber, setKey, setLoopBars, setTempo, suggest } from "@untzel/language";
import type { CommandContext } from "../reading/context";
import { error, type CommandOutcome } from "../proposal/outcome";
import { strings } from "../copy/copy";
import { SCALES, TONICS } from "../reading/vocabulary";

// tempo, key and loop: the statements before the tracks.

export function tempo(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(1);
  if (!limit.ok) return limit.outcome;
  const bpm = context.number(0, "tempo", strings.tempoNeedsBpm, { min: MIN_TEMPO, max: MAX_TEMPO, integer: false });
  if (!bpm.ok) return bpm.outcome;
  return context.propose(setTempo(context.source, bpm.value), {
    title: context.line,
    summary: strings.tempo(printNumber(bpm.value) ?? ""),
    destructive: false,
  });
}

export function key(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(2);
  if (!limit.ok) return limit.outcome;
  const tonic = context.argument(0, strings.keyNeedsTonic);
  if (!tonic.ok) return tonic.outcome;
  if (!TONICS.includes(tonic.value.text)) return error(strings.invalidTonic(tonic.value.text), context.example);
  const scale = context.argument(1, strings.keyNeedsScale);
  if (!scale.ok) return scale.outcome;
  if (!SCALES.includes(scale.value.text)) {
    const near = suggest(scale.value.text, SCALES);
    return error(strings.unknownScale(scale.value.text), near === null ? null : context.suggestLine(scale.value, near));
  }
  return context.propose(setKey(context.source, tonic.value.text, scale.value.text), {
    title: context.line,
    summary: strings.key(tonic.value.text, scale.value.text),
    destructive: false,
  });
}

/** `loop <bars>`: the length of one pass in loop mode. */
export function loop(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(1);
  if (!limit.ok) return limit.outcome;
  const bars = context.number(0, "loop", strings.loopNeedsBars, { min: MIN_LOOP_BARS, max: MAX_LOOP_BARS, integer: true });
  if (!bars.ok) return bars.outcome;
  return context.propose(setLoopBars(context.source, bars.value), {
    title: context.line,
    summary: strings.loop(bars.value),
    destructive: false,
  });
}
