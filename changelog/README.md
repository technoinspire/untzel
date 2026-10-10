# Changelog

What changes for the people who play Untzel, published at `app.untzel.com/changelog.json` with
every release and shown on the official site at `untzel.com/docs/changelog`.

## One entry per pull request

Every pull request that changes what people see or hear in the app (`apps/web`,
`packages/*/src`, `instruments/`) adds **one new file** to `changelog/entries/`. CI fails
without it, unless the pull request has the `no-changelog` label (refactors, tests, tooling).
One file per pull request: two pull requests in parallel never edit the same file.

```json
{
  "category": "new",
  "docs": "/docs/app/play-range",
  "title": { "en": "Play range", "pt-BR": "Trecho de execução" },
  "body": {
    "en": "Choose the stretch that plays in Loop and Song.",
    "pt-BR": "Escolha o trecho que toca no Loop e no Song."
  }
}
```

- `category`: `new`, `improved` or `fixed`;
- `title` (up to 80 characters) and `body` (up to 280), always in `en` and `pt-BR`, about
  what a person gains while playing, never about the code;
- `docs` (optional): the path of the public doc that explains the change;
- `date` and `refs` are left out: the date and the pull request number come from the squash
  commit that brought the file to `main`. Only the older, migrated entries carry both.

File name: short and descriptive (`play-range.json`); entries of the same day are ordered by
file name. Never tie Untzel to a music genre, and never write "coming soon" (or "em breve").

## Commands

```bash
pnpm changelog:check                      # validates every entry
pnpm changelog:check --base origin/main   # and requires the entry when the PR changes the app
pnpm changelog:build                      # writes apps/web/dist/changelog.json
```
