# tom

Toms, floor to high. Engine: modal (`packages/dsp/src/engines/modal/`),
4 voices, poly, kind `drum`.

```untzel
tom x... .... x.x. ....
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `tune` | 0..1  | 0.35 | linear |
| `decay` | 0.05..2 s | 0.55 | exponential |
| `bend` | 0..1  | 0.25 | linear |
| `hardness` | 0..1  | 0.5 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `floor` | Low floor tom | defaults |
| `high` | High rack tom | `tune 0.7`, `decay 0.35` |
| `boom` | Big and long | `tune 0.15`, `decay 1.2`, `bend 0.4` |
| `electronic` | Synth tom with a pitch drop | `bend 0.85`, `hardness 0.2`, `decay 0.5` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
