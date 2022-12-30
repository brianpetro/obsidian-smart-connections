# Smart Connections

Smart Connections uses AI to help you prevent rework by increasing awareness of your [Obsidian](https://obsidian.md/) vault's most relevant notes in real time. 

## Features

Inspired by the ['Similar mems' feature from Mem.ai](https://get.mem.ai/mem-x), this plugin uses AI to find similar notes in your vault and display them in real time.

## Installation

1. Install the plugin from the community plugins tab in Obsidian.
2. Create an account at [OpenAI](https://beta.openai.com/) and retrieve your API key from the [API Keys](https://beta.openai.com/account/api-keys) page.
3. Open the plugin settings and enter your API key.

**Note:** The plugin will not work without an OpenAI API key.

### Initial processing
- The plugin will process all your notes and store the embeddings in a hidden folder in your vault called `.smart-connections` in a file called `embeddings.json`. This file is used to cache the embeddings of your notes so that they do not need to be recalculated each time you open a note. `file.mtime` is used to determine if a note has been modified since the last time Smart Connections calculated the embeddings. The `embeddings.json` file can get to be quite large, so it is recommended that you exclude the folder from your sync settings.
- The initial processing may take a while, depending on the number of notes in your vault.
- The plugin will only process notes that are in the current vault. It will not process notes in other vaults.
- The cost of the initial processing is proportional to the number of notes in your vault. Without any exclusions configured in the settings, the amount of tokens used in the initial processing is approximately 2X the total number of "tokens" in your entire vault. A rough calculation for this is `the total number of characters in the vault` divided by `2`. For example, if your vault contains 100,000 characters, then the initial processing will cost approximately 50,000 tokens. The current token cost is $0.0004 per 1,000 tokens (as of [2021-08-01](https://openai.com/api/pricing/)) which is estimated to be ~$1 USD for 3,000 pages (assuming 800 tokens per page).

## Usage

- The Smart Connections Pane is opened when you activate the plugin. You can also open it from the command palette with the "View: Open Smart Connections Pane" command.
- You can click on a note to open it in the current pane or hold down the `ctrl` or `cmd` to open it in a new pane.
- To preview the notes in the Smart Connections Pane, you can hold down the `ctrl` or `cmd` key to preview the note while hovering over it.
- Each time you open a note, the plugin will search for similar notes in your vault and display them in the Smart Connections Pane (sidebar). The Smart Connections Pane will display the most similar notes first using the cosine similarity of the note's embeddings.
- The plugin will only search for similar notes in the current vault. It will not search for similar notes in other vaults.
- 'Block' searches: the Smart Connections plugin will make smart connections to 'blocks' of text in your notes. A 'block' is a section of text that is separated by a header. For example, if you have a note that contains the following text: `# Header 1\nThis is a block of text.\n# Header 2\nThis is another block of text`, then the plugin will search for similar blocks of text in addition to making smart connections with similar files.
- The plugin is currently a desktop-only plugin.

## Settings

- `API Key` - Enter your OpenAI API key.
- `File Exclusions` - Enter a comma-separated list of file or folder names to exclude from the search completely. For example, if you want to exclude all files that contain the word "drawings" in the file name, you can enter "drawings" in the field. If you want to exclude all files that contain the word "drawings" or "prompts" in the file name, you can enter "drawings,prompts" in the field.
- `Path Only` - Enter a comma-separated list of file or folder names. Only the file names and paths of files that match will be used when searching for similar notes. For example, contents of notes in the "drawings/" folder may be excluded while continuing to index their file names and paths. This can be useful for non-markdown notes that contain a lot of text that may not be relevant to the search, like Excalidraw drawings or spreadsheets.
- `Heading Exclusions` - Enter a comma-separated list of headings to exclude. For example, if you have a commonly occurring "Archive" section in many files and do not want the contents to be included when making smart connections. Smart Connections will exclude 'Blocks' with headings that match the Heading Exclusions from the search. This only applies to 'blocks' and does not change the content used for matching entire files.


## Under the hood
The plugin integrates [OpenAI Embeddings](https://beta.openai.com/docs/guides/embeddings), a technology from the organization behind ChatGPT, to use AI that finds connections between notes. Instead of matching keywords, the AI interprets your notes as 1,536-dimension vectors!