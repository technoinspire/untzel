# rim

Rim shot and wood clicks. Engine: modal (`packages/dsp/src/engines/modal/`),
4 voices, poly, kind `drum`.

```untzel
rim ..x. ...x ..x. ....
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `tune` | 0..1  | 0.5 | linear |
| `decay` | 0.01..0.5 s | 0.05 | exponential |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `click` | Short bright rim | defaults |
| `wood` | Hollow wood block | `tune 0.3`, `decay 0.12` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
