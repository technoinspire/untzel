# snare

Snare drum, tone and wires. Engine: percussion (`packages/dsp/src/engines/percussion.rs`),
4 voices, poly, kind `drum`.

```untzel
snare .... x... .... x...
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `decay` | 0.05..1 s | 0.2 | exponential |
| `tune` | 0..1 | 0.5 | linear |
| `snap` | 0..1 | 0.6 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `snap` | Crisp wires | defaults |
| `fat` | Lower and longer | `tune 0.3`, `decay 0.32`, `snap 0.5` |
| `boom` | Deep body, few wires | `tune 0.05`, `decay 0.6`, `snap 0.1` |
| `brush` | Soft swept wires | `snap 0.95`, `decay 0.35`, `tune 0.6` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
