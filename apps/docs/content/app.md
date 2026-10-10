# Using the app {#app}

Untzel is one page: tracks, song, code and track details open as tabs and sheets over the stage, so moving around never interrupts the sound. The labels below are the ones the app shows in the language of this page.

## The screen {#screen}

- **Top bar**, over the stage: the Untzel logo, linked to untzel.com, a divider and the title of the song ([Projects and the song title](#projects)). On a computer **{{label saved}}** next to the title says the project is stored on this device. At the right, **{{label export}}** and **{{label menu}}** ([The menu](#menu)). Export stays inactive until the first tap: it acts on the music that plays.
- **Stage**: the light. It reacts to the notes as they play and is decorative for screen readers.
- **Transport**: play and stop, tempo, key, the mode and the position. Then the button that hides the controls, **Code** and **Drop**. On a computer the transport is one line with the `Loop` / `Song` switch. Under it, in both modes, the play range and its ruler ([Play range](#play-range)); in Loop mode the **Length** chip sits next to them ([Loop length](#loop-length)). The CPU meter is in the transport from 1024 px wide; on a narrower screen it moves to the footer of the instrument library.
- **Tracks**: a grid of tiles on a phone, a table on a computer.
- **Song**: the parts of the song as a list, in the order they play. A tab on a phone; on a computer, next to the tracks in Song mode.
- **Code**: the text itself.
- **Footer**: the line "Powered by Untzel · Techno Inspire", across the whole width and always on screen. Nothing the app opens covers it.

## Waiting screen and templates {#waiting}

Before the first tap the stage shows a slow haze and the **{{label tapToPlay}}** button. Below it, **{{label startFromTemplate}}** shows the template library: the **{{label musicStyle}}** list, with every music style in alphabetical order and the number of projects of each, and below it the projects of the open style as cards with their name, tempo and key, read from the text itself. On the keyboard, type the first letters of a style to jump to it. Tap a card, then **{{label tapToPlay}}**, and that project plays; everything in a template can be changed: add tracks, edit every step and sound, build a whole song. With no choice, the first tap plays the template marked as the first one.

When this device already has a project, the waiting screen also offers **Continue** followed by the title of the project you edited last, which opens it ([Projects and the song title](#projects)).

The **{{label blank}}** card comes before the style list. Pick it and the button becomes **{{label startFromScratch}}**: it turns the sound on and opens an empty project without playing. With no track, the tracks area says **{{label startWithSound}}** and offers **{{label addTrack}}** and four starters (kick, bass, hats, chords): each one enters with a ready pattern, in the key of the project, and starts the music.

The library of this build, generated from its template folder. The project names are names, not copy, so they read the same in every language:

{{templates}}

{{status more-templates}}

{{status saved-session}}

## The menu {#menu}

**{{label menu}}**, at the right of the top bar, opens one menu for the whole app: a sheet on a phone, a panel under the button on a computer. The arrow keys walk every item in reading order, `Home` and `End` go to the ends, a letter jumps to the next item that starts with it, and `Esc` closes the menu and returns focus to the button. The groups, in this order:

- **{{label menuProject}}**: **{{label newProject}}** (blank or from a template), **{{label openProject}}**, **{{label renameSong}}**, **{{label duplicate}}**, **{{label saveFile}}**, **{{label openFileMenu}}** and **{{label deleteProject}}**, which you can undo for 10 seconds. With no project open, only the items that do not need one are there.
- **{{label menuShareExport}}**: **{{label shareLinkMenu}}** and **{{label exportMedia}}** ([Share and Export](#share-export)). The group appears only with a project open. Like **{{label export}}**, both stay inactive until the first tap, and their hint says why.
- **{{label menuSettings}}**: **{{label language}}**, with Português and English, changes every label at once without reloading; the choice is saved on this device. **{{label previewSounds}}** plays the notes while you edit them. **{{label reducedMotion}}** follows the system until you change it here, and then says it is set on this device. The switches and the language keep the menu open.
- **{{label menuHelp}}**: **{{label documentation}}**, which opens these pages in a new tab, **{{label keyboardShortcuts}}** and **{{label aboutLicence}}**.

These docs and the app live on different addresses, so the language picked on these pages does not carry over to the app: pick it in the app's menu.

## Projects and the song title {#projects}

Every project has a title. The title is the `title` line of the text ([Language guide](language.md#title)): the top bar shows it, the browser tab reads `<title> · Untzel`, and it names the files you save and export. Tap the title in the top bar, or choose **{{label renameSong}}** in the menu, to rename the song: `Enter` or leaving the field renames, `Esc` gives up. A new project is called **{{label untitled}}**, a template keeps the template's name, a received link opens as **{{label remixPrefix}}** followed by its title, and a duplicate adds **{{label copySuffix}}**.

Projects are saved in this browser, on this device, and never leave it. A project is stored one second after your first edit, and again one second after each later one; a template you only played creates nothing. `Mod+S` saves at once, without a dialog. **{{label openProject}}** lists the projects of this device, the one edited last first, each with when it was edited, its tempo and how many tracks it has; its buttons rename, duplicate, save as a file or delete it, and a search appears above eight projects. Opening, creating, duplicating or deleting a project stops the music cleanly and goes back to the waiting screen; nothing you were editing is lost on the way.

Clearing the browser's data deletes the projects: **{{label saveFile}}** keeps a copy. Where the browser refuses to store anything (a private window, a full disk), the app says so and the open project keeps playing; it is just not saved.

{{status projects}}

{{status song-title}}

## Tracks {#tracks}

Each track is a tile with its name, its instrument, a 16-step preview and an adjust button.

| Gesture on a tile | What happens | When |
|---|---|---|
| tap | turns the track on or off | on the next bar; a ring fills until then |
| drag up or down | with a mouse or a pen, moves the track's `tone`; with a finger, scrolls the tracks (the tone is in the track detail) | immediately |
| hold | solo while you hold | immediately |
| adjust button | opens the track detail | |

On a computer the table shows the name, the pattern, `M` (mute), `S` (solo) and `tone` for every track.

Every name the app shows can be edited where it appears: a track in the head of its detail, or with a double-click and the pencil in the table; a part in the pencil of its row and in the head of its editor. Lowercase letters, numbers, `-` or `_`, starting with a letter, up to 24 characters; the words of the language are not names. `Enter` or leaving the field renames, `Esc` or **{{label cancel}}** gives up, and a wrong name is explained under the field and never written. Renaming a track also renames it in every `section`; renaming a part renames it in the `song`. One edit, one undo step, and the music keeps playing.

## Adding a track {#add-track}

The last tile is always **{{label addTrack}}**. It opens the instrument library: a search over names, model names, sounds, descriptions and tags, the chips **{{label all}}** and nine categories (Drums, Bass, Keys, Plucks, Pads, Brass, Leads, Voices, FX), and the instruments grouped, each with its model name, how many tracks already use it, its description and its number of sounds. A group shows three instruments until you ask for all of them.

The play button of a row previews the instrument in the key of your music while the music keeps playing; its sounds appear as chips, and tapping one switches the preview. The add button adds the instrument with the sound you are hearing. The new track gets the next free name (`hat2`, `bass3`), the instrument's default pattern, and starts on the next bar; the sheet closes and the new track's detail opens. You can pick the same instrument as many times as you like: each track is its own instance. When nothing matches, the sheet suggests up to three close names.

`piano`, `strings`, `harp`, `mallet`, `bell`, `kalimba` and `choir` play recordings, and so do the `ooh` and `aah` sounds of `vox` ([Instruments](instruments.md), [Credits](credits.md)). A recording is downloaded only when a track uses it; until it arrives, the instrument plays its synthesized voice, so the music never waits.

{{status recorded-voices}}

{{status recorded-instruments}}

{{status instrument-library}}

## Track detail {#track-detail}

The detail shows everything about one track: solo and mute, the length of its pattern, the steps per bar, the bars of the pattern, the step grid, its sound, its effects and its mix. **{{label duplicate}}** and **{{label delete}}** sit at the bottom.

- The **Pattern** chip picks how many bars the pattern has; new bars repeat the last one. **{{label stepsPerBar}}**, `8 · 16 · 32`, rewrites every bar of the track; the steps that exist keep their place in time.
- The bar thumbnails show the steps of each bar; the one you edit has an orange outline and the one playing a white mark. The arrows, or a swipe on the grid, change the bar you edit, and **{{label copyBar}}**, **{{label pasteHere}}** and **{{label clearBar}}** act on it.
- On a drum, tapping a step turns it on or off. On an instrument with notes, tapping a step selects it and opens the note picker: any note of the instrument's range, a hold or a rest, chords on a chord instrument, and **{{label scaleLock}}**, which keeps the step in the scale of your music. With **{{label previewSounds}}** on, here or in the menu, the notes play as you edit them.
- **{{label sound}}**: the sound picker lists the instrument's sounds with their descriptions, and below it one control for every parameter of the instrument ([Instruments](instruments.md)).
- **{{label effects}}**: the insert effects in chain order, each with its controls and a ×; **{{label addEffect}}** adds one at the end of the chain.
- **{{label patterns}}**, under solo and mute: the instrument's ready patterns as chips, the current one marked. A tap previews the pattern in the track itself, from the next bar for 16 bars, without changing the text; a second tap, or **Use**, writes it. The patterns enter already in the key of your music.
- **{{label changeSound}}**, next to **{{label sound}}**, swaps the instrument and keeps the pattern: the library opens listing only the instruments that can play it, and says what is kept and what is dropped.
- **Tone** is one knob over several parameters. When the text writes one of them (`open`, `cutoff`), that parameter wins: the knob says who sets it and **{{label useTone}}** takes the written parameter out, with an Undo.
- **{{label mix}}**: `gain` is a fader in dB, from Off through −60 dB to +6 dB, with 0 dB at three quarters of the travel; a double tap returns to 0 dB. The text keeps `gain` as a plain number (`gain 1` is 0 dB). Then `pan`, `reverb` and `duck`.

Every change here becomes a small edit of the text, which you can undo.

## Transport and Drop {#transport}

**Drop**, in loop mode, turns every muted track on in one edit, on the next bar. In song mode it stays in place but does nothing.

The tempo and the key in the transport are buttons. The tempo opens `−`, a field and `+` from {{limit MIN_TEMPO}} to {{limit MAX_TEMPO}} BPM, and **{{label tapTempo}}** (four taps, or `T` on a keyboard). The key opens the twelve tonics and the scales `minor`, `major`, `dorian`, `phrygian` and `chromatic`; notes outside the new scale move to the nearest note in it. The key is written in lowercase, as in the text (`a minor`), in every language. Both enter on the next bar. In Song mode, when the part playing has its own `| tempo`, the button shows the tempo that sounds and the editor, **{{label songTempo}}**, still edits the `tempo` line.

**{{label undo}}** and **{{label redo}}** sit in the transport on a phone and in the head of the Code panel on a computer, and say what they took back. On a keyboard, `Ctrl+Z` and `Ctrl+Shift+Z` (`Command` on a Mac).

The CPU meter shows how much of the device the music uses. The language has no limit on tracks; the device does, and the meter is how you see it. From 1024 px wide it sits in the transport; on a narrower screen it is in the footer of the instrument library, and above 80% the library warns that the device is near its limit.

## Loop length {#loop-length}

In Loop mode the transport has the **Length** chip. It opens the length choice, 1, 2, 4, 8 or 16 bars; a tap picks one and closes it, and `[` and `]` step through the same lengths on a keyboard. The chip writes `loop <bars>` in the text ([Language guide](language.md#loop-length)) and the new length enters on the next bar, without stopping the music. Any other length, up to {{limit MAX_LOOP_BARS}}, is written in the Code panel, and the chip then shows it as written. The chip is hidden in Song mode, where the song decides the length.

{{status loop-length}}

## Play range {#play-range}

Under the transport a ruler shows the loop, one segment per bar, or the song, one block per part, with the bar that is playing lit. On it you choose the play range: the stretch that repeats while you work, from one bar up to all of them.

- Drag one of the two handles, or tap a first bar and then a last one. The row above the ruler says what is chosen, `Range: bars 3–6`; its × (`Clear range`) goes back to the whole loop or song.
- On a keyboard, a focused handle moves one bar with the arrows and four with `Shift` or `PageUp` and `PageDown`; `Home` and `End` go to the ends.
- The position follows the range: `Loop · bars 3–6 of 8 · bar 4`.
- The range enters on the next bar and the music never stops. Outside the new range, the music jumps to its start at that bar; inside it, it goes on without a jump.

In Loop mode the range always repeats. In Song mode the row has a **Cycle** switch: on, the range repeats; off, the music starts there and plays on into the rest of the song.

The range is how you play, not what the music is, like play, stop and the mode. It is never written into the text, so undo does not undo it, and for now it is not kept in the link or the file either: it lasts while the app is open. Each mode keeps its own.

{{status play-range}}

## Loop and Song {#modes}

In **Loop** mode every track without `mute` plays forever. In **Song** mode the sections play in the order of the `song` line ([Language guide](language.md#sections)). Switching modes while playing takes effect on the next 4-bar phrase, and entering Song starts from the first part.

In Song mode the parts of the song are a list, in the order they play: each with its name, its length and how many tracks it has; the one playing fills as it goes. Each row has its own play button, `Play <part> only`: it sets the range to that part with **Cycle** on, and the part plays alone, round and round, from the next bar; a second tap while the music plays clears the range. The bracket button of a row sets the range to start at that part, and **To here** extends it to another one.

Open a part to choose its tracks, its length, **{{label playFromHere}}**, **{{label duplicate}}** and **{{label move}}**. **{{label playFromHere}}** moves the start of the range to that part, or, with no range, plays the song from there, on the next bar. **{{label addPartFromPlaying}}** writes a new section with the tracks that sound and adds it to the end of the song. That is how you build and play a finished song live.

## The Code panel {#code}

**Code**, next to **Drop**, opens the text. Tap it again to close it. While the music plays, the words that are sounding light up in orange.

- When you stop typing, the text is analyzed. If it is valid, it plays from the next bar; a line under the editor shows how long until then.
- If it is invalid, the wrong part is underlined, the message appears in the language of the app with its stable English code, and the previous version keeps playing. Nothing stops.
- When a gesture changes the text, the changed line is highlighted for a moment.

The editor reads the text as the Untzel language: keywords, instruments, notes, numbers and comments each have their colour, and every track line carries the colour of its track in the margin, the same colour as its light on the stage and its dot in the tracks. On a phone a long line only wraps before a `|`, so a modifier never sits alone. On a computer the panel's left edge is a divider: drag it, or focus it and use the arrows, to make the panel wider; a double-click returns to the default width.

- **Completion.** `Ctrl+Space` lists what fits where the cursor is: instruments and statements at the start of a line, notes and chords of your key in a pattern, parameters after `|`, signals with the parameter's whole range, tonics and scales after `key`, tracks after `section`, sections after `song`. The arrows choose, `Enter` or `Tab` accept, `Esc` closes.
- **Help under the cursor.** Resting on a word, or `Alt+I` on a keyboard, shows what it is: a parameter with its range, default and unit, an instrument with its group and parameters, a signal with its shape and period.
- **Quick fixes.** An error with a known fix shows a button under the message, for example `Change to kick` for `kik`, next to **Ignore**. `Mod+.` applies the fix under the cursor, or the first one of the text. A fix touches only the part it names, and the music keeps playing.
- `Esc` says how to leave: right after it, `Tab` moves out of the editor, and `Esc` again closes the panel.

{{status composer-terminal}}

Under the code, the **Commands** button opens a command line, closed by default. Each command makes the same minimal edit as the controls do, through the same text: it is read, never executed, and the music never stops. A change that removes something, or touches more than one line, first shows a preview of the lines that change with **Apply** and **Cancel**; nothing changes until you apply. While the music plays, a change enters on the next bar and the line says so, then says from which bar it plays.

- `Enter` runs the line. `Tab` completes with the chosen suggestion, `Alt+↓` and `Alt+↑` choose another, `↑` and `↓` walk the history. `Esc` closes the suggestions or cancels a preview, and `Mod+Enter` applies it.
- A command with a typo answers with the closest one: `mute kik` offers `mute kick` as a chip, and a tap writes it on the line.
- `help` lists the commands, `help <command>` explains one, and `explain` says in plain words what a line or a track does. Results and help read in the language of the app; the commands themselves are words of the language and stay as written.
- The divider between the code and the commands moves with a drag or, focused, with the arrows.

{{commands}}

## Hide the controls {#hide-controls}

The round button in the transport hides everything under it, so the stage fills the screen; `H` does the same on a keyboard. The transport stays with play, the position, **Code** and **Drop**; the top bar and the footer with the attribution stay as they are. The choice is saved on the device and the music never stops while you switch.

## Keyboard shortcuts {#shortcuts}

{{shortcuts}}

## When a change plays {#next-bar}

A change to a plain number, such as `gain 0.6` to `gain 0.4`, sounds immediately. Everything else waits for the next bar: patterns, tracks, `mute`, signals, tempo, key, sections and the song. That is why the music never jumps.

A pattern can be up to {{limit MAX_BARS_PER_PATTERN}} bars long, the loop from {{limit MIN_LOOP_BARS}} to {{limit MAX_LOOP_BARS}} bars, and a part of the song from {{limit MIN_PART_BARS}} to {{limit MAX_PART_BARS}} bars.

## Sheets {#sheets}

Every sheet and the side panel close with the × button and with `Esc`, and focus returns to the control that opened them. On a phone, a sheet with a handle also closes when you drag it down.

## Share and Export {#share-export}

**{{label shareLinkMenu}}**, in the menu, opens the share sheet, which sends your music as a link; when the song is too long for a link, it offers a `.untzel` file instead. **{{label saveFile}}** and **{{label openFileMenu}}**, in the menu, save and open a `.untzel` file at any time, and a file dropped on the stage opens too.

**{{label export}}**, in the top bar, opens the export sheet. Opening it renders nothing: you choose first, then press **{{label render}}**.

- **{{label format}}**: **Story** 9:16, **Video** 16:9 or **Audio** WAV, each with the length the file will have, closing card included.
- **{{label range}}**: with a play range, **{{label selectedRange}}** is chosen. It starts as a copy of the play range on the same ruler as the transport, and its two handles move by steps (1/16 of a note; **Fine**, Shift or Alt for 1/64), so a video can start and end on any step. The start and the end show as time and bar.beat. The Story takes up to 1:00, video and audio up to 10:00, 4K up to 4:21; a handle stops at the limit and the line under the ruler says why. Editing it never changes what plays, and **Use play range** returns to the copy. **Listen**, next to **Fine**, plays the range from its first bar and stops after its last; pressed again, as **Stop**, it stops at once. The play range stays as it was, the export ruler shows the bar that sounds, and closing the sheet does not stop the music. Without a play range, the Story starts on **{{label nowPlaying}}**, about 15 seconds from the bar that sounds, and video and audio on the loop or the song, with **{{label selectedRange}}** one tap away. In the song, **{{label from}}** and **{{label to}}** pick the parts, and in the loop, **{{label bars}}** picks 8, 16, 32 or 64 bars.
- **{{label quality}}**, for video: **HD** and **4K**, each with its resolution, HD chosen. {{label checksDeviceFirst}} After that test, 4K shows only on a device that can render it in time, with about how long the render takes.
- The preview shows what the file will contain: the light in the format's shape, the Techno Inspire | Untzel logo and the address untzel.com, apart from the logo, on every frame, the song's title on a card for the first 1.5 seconds and then as a caption, and the 2-second closing card with only the logo and the address.

Videos are MP4 files with H.264 video and AAC sound, 12 Mbit/s in HD and 30 Mbit/s in 4K; where the browser cannot encode AAC the sound is Opus, and the line that says the file is ready adds **{{label exportOpusAudio}}**. The song's title names the file and goes into its metadata, in MP4 and in WAV. On a device that cannot encode H.264, Story and Video are inactive and the sheet suggests the WAV export or another browser. When the video encoder does not answer in time, the sheet says so and shows **{{label tryAgain}}**, which starts the same render again.

While it renders, the sheet shows the progress and the time left, with **{{label cancel}}**, and the music keeps playing. When it is done the preview becomes the file itself, and **{{label download}}** saves it; where the system accepts files, **{{label share}}** sends it. The logo and the closing card are a condition of the license and have no option to remove them.

{{status share-link}}

{{status export}}

{{status export-4k}}

