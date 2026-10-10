# Security policy

## Supported versions

| Version | Supported |
|---|---|
| The latest release (served at app.untzel.com) | yes |
| `main` | yes |
| Older releases | no: update to the latest release |

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Report it privately through GitHub:
[**Report a vulnerability**](https://github.com/technoinspire/untzel/security/advisories/new).
Only the maintainers can read the report. No e-mail address is needed.

Please include:

- what the problem is and what an attacker could do with it;
- the steps to reproduce it, ideally with an Untzel text, a share link or a file that shows
  it;
- the browser, its version and the operating system;
- what you tested: the hosted app with the date, a release tag, or the commit of a local copy
  (`git rev-parse HEAD`);
- whether the problem is already public anywhere.

## What happens next

- We answer within **7 days**, confirming that we received the report.
- We investigate, tell you whether we can reproduce it and agree with you on a fix and a date
  to disclose it.
- The fix ships in a release, and we publish a GitHub security advisory that credits you,
  unless you prefer to stay anonymous.

There is no bug bounty program.

## Scope

In scope:

- the app (`apps/web`), the Untzel language and its analyzer, the sound engine (DSP), the
  player, the share links and files, the export, and the release package;
- [untzel.com](https://untzel.com) and its docs: report them through the same form, and we
  forward the report to the team that runs the site.

Out of scope: problems that need a compromised device or browser, social engineering, and
reports from automated scanners without a demonstrated impact.

The Untzel language is analyzed, never executed: a text that makes the app run code, read
data it should not or escape the page is a vulnerability, and we want to hear about it.
