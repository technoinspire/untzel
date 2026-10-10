# impact

Hit for section changes. Engine: percussion (`packages/dsp/src/engines/percussion.rs`),
2 voices, poly, kind `drum`.

```untzel
impact x... .... .... ....
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `decay` | 0.1..4 s | 3.2 | exponential |
| `size` | 0..1 | 0.5 | linear |
| `color` | 0..1 | 0.1 | linear |
| `tail` | 0..1 | 0.6 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `hit` | A dropping sub and a washed noise burst | defaults |
| `deep` | Deep sub drop, a dark short tail | `size 1`, `decay 4`, `tail 0.1`, `color 0` |
| `metal` | Metallic crash hit in a long wash | `color 0.8`, `size 0.3`, `tail 0.7` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
