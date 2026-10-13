# Start here {#start}

Untzel is a music instrument that runs in your browser. You tap once and a loop starts, picked from a template library by music style; then you change it with your fingers or by editing a short text, and the music never stops while you do.

## What Untzel is {#what-it-is}

Every sound you hear is one line of a small text language. The track tiles, the song timeline and the code editor all edit that same text, so whatever you build by touch you can read as code, and whatever you write as code shows up as tiles.

The sound is made on your device: a sound engine written in Rust runs as WebAssembly inside the browser's audio thread, and the light on the stage follows the same events the engine plays. Nothing is streamed and you need no account.

Untzel is open source: the code, the language and every instrument are on GitHub at [technoinspire/untzel](https://github.com/technoinspire/untzel), under CPAL-1.0.

The text is analyzed, never executed. There is no JavaScript inside it, no functions and no imports, so it is safe to paste text that someone else wrote, or that an assistant wrote for you ([Using AI](ai.md)).

## Tap to play {#tap-to-play}

Open [app.untzel.com](https://app.untzel.com/) and tap **{{label tapToPlay}}**. Browsers only allow sound after a gesture, so that first tap is what starts the audio. The music starts on the next bar, in loop mode.

This is the text the app plays first, exactly as this build ships it:

{{template first-touch}}

## Your first loop in 2 minutes {#first-loop}

1. Tap **Code**, next to **Drop**. On a phone the code opens as a sheet; on a computer it opens in the side panel.
2. Select all of the text and replace it with this:

{{example first-loop}}

3. Stop typing. On the next bar the new text plays.
4. Change one number, for example `cutoff 500` to `cutoff 1200`. A change to a plain number sounds right away; a change to a pattern waits for the next bar.
5. Break something on purpose: delete a letter of `kick`. The line gets an error mark with a message, and the previous version keeps playing. Invalid code never stops the music.

## Where to go next {#next}

- [Using the app](app.md): every screen, gesture and keyboard shortcut.
- [Language guide](language.md): the language, one idea at a time, each with an example you can paste.
- [Cookbook](cookbook.md): grooves, builds and a whole song with the instruments that exist today.
- [Using AI](ai.md): a ready prompt that teaches an assistant to write Untzel for you.
