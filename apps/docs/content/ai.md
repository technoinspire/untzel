# Using AI {#ai}

An assistant such as ChatGPT, Claude or Gemini can write Untzel code for you, if it knows the language first. The prompt below teaches it everything it needs: the syntax, the instruments of this build with every parameter and range, the limits and the errors. Then you ask for music in your own words and paste the answer into the app.

## How it works {#how}

1. Copy the prompt below and paste it at the start of a conversation with the assistant.
2. Ask for what you want to hear: a style, a tempo, a mood, a structure.
3. The assistant answers with one block of Untzel code. Copy only the code.
4. Paste it into the Code panel. It plays on the next bar.

The prompt is generated from the same sources as these pages, so it always lists the instruments and limits of this build. It is in English because the code is; the assistant answers in the language you write in. The same text is in [llms-full.txt](https://untzel.com/docs/llms-full.txt), for tools that read it directly.

## The prompt {#prompt}

{{ai-prompt}}

## Example requests {#examples}

Three requests and an answer that follows the prompt. Each answer plays as it is.

### A melodic groove {#example-groove}

"Write a 124 BPM loop in A minor, deep and hypnotic, with a bass melody."

{{example ai-groove}}

### A build before the drop {#example-build}

"Add a 4-bar build before the drop that rolls the hats and opens the filter."

{{example ai-build}}

### A whole song {#example-song}

"Turn it into a whole song of about three minutes, with an intro, two drops and a break."

{{example ai-song}}

## Paste into the Code panel {#paste}

Open **Code**, next to **Drop**, select all the text, and paste the answer over it. Copy only what is inside the code block: the lines before and after it are the assistant talking. When you stop typing the text is analyzed, and if it is valid it plays on the next bar. In Song mode the song starts from its first part.

## Reading the errors {#errors}

If the answer has a mistake, the app underlines it and shows a code and a message, such as `UNKNOWN_MODIFIER` with `"bass" has no parameter "cutof". Did you mean "cutoff"?`. The previous version keeps playing. Copy the message back to the assistant and ask it to fix exactly that; the prompt teaches it every code. The [reference](reference.md#errors) lists every error with its fix.

## Good requests {#tips}

- Say the tempo and the key, or ask the assistant to choose them.
- Name the parts you want: a loop, or a song with intro, build, drop, break.
- Ask for one change at a time once you like the music: "more swing on the hats", "a darker bass".
- Ask for instruments the app has. If you ask for one it does not have, the prompt tells the assistant to say so and use the closest one.
