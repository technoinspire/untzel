# perc

Tuned hits, blocks and pings. Engine: modal (`packages/dsp/src/engines/modal/`),
4 voices, poly, kind `drum`.

```untzel
perc ..x. .x.. ...x .x..
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `tune` | 0..1 | 0.5 | linear |
| `decay` | 0.05..2 s | 0.22 | exponential |
| `bend` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `block` | Wooden block | defaults |
| `ping` | Bright metal ping | `tune 0.75`, `decay 0.45` |
| `drop` | Falling water drop | `bend 0.6`, `tune 0.4`, `decay 0.3` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
