# Scraps

Lightweight [Thino](https://github.com/Quorafind/Obsidian-Thino) / [Memos](https://github.com/usememos/memos) alternative for Obsidian.
Read and write timestamped memos directly in your Daily Notes.

## Features

- **Memo input with live preview** -- CodeMirror 6 editor with inline Markdown rendering
- **Vim mode support** -- Automatically enables Vim keybindings when Obsidian's Vim mode is active, with vimrc loading and register bridge
- **Markdown list auto-continuation** -- Pressing Enter in a list item continues the list (ordered, unordered, task)
- **Timeline view** -- Reverse chronological display with date group headers
- **Text search** -- Real-time content filtering across all loaded memos
- **Date range filter** -- Narrow the timeline to a specific date window
- **Tag filter** -- Automatic `#tag` extraction with chip-based filtering
- **Memo deletion** -- Delete individual memos with confirmation prompt
- **Inline editing** -- Edit existing memos in place with CodeMirror 6
- **Global capture** -- Command palette action (`Capture scrap`) to add memos from anywhere
- **Sidebar & center pane** -- Open as a right sidebar panel or in a center tab
- **Auto-create daily note** -- Optionally creates today's daily note when adding a memo
- **Incremental loading** -- "Load more" button to fetch older memos on demand
- **Live reload** -- Automatically refreshes when daily note files change
- **Mobile support** -- Works on iOS and Android

## Installation

### BRAT (recommended for beta)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin
2. Open BRAT settings and select **Add Beta plugin**
3. Enter `hideakitai/obsidian-scraps` and confirm
4. Enable **Scraps** in Settings > Community plugins

### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](https://github.com/hideakitai/obsidian-scraps/releases/latest)
2. Create a folder at `<vault>/.obsidian/plugins/obsidian-scraps/`
3. Copy the downloaded files into the folder
4. Restart Obsidian and enable the plugin in Settings > Community plugins

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Section heading | Heading name in daily notes where memos are stored (without `##`) | `Thino` |
| Display range (days) | Number of days to display initially | `7` |
| Time format | Timestamp format for new memos (`HH:mm:ss` or `HH:mm`) | `HH:mm:ss` |
| Auto create daily note | Create today's daily note automatically if it doesn't exist | Off |

## Memo format

Memos are stored as timestamped list items under the configured section heading in your daily notes:

```markdown
## Thino

- 09:30:00 First memo of the day
- 10:15:00 Another memo with **markdown** support
  continuation lines are indented
- 14:00:00 Task list memo
    - [ ] Sub-task 1
    - [x] Sub-task 2
```

## Development

```bash
npm install       # Install dependencies
npm run dev       # Development (watch mode)
npm run build     # Production build
npm test          # Run tests
npm run lint      # Lint
```

## License

[MIT](LICENSE)
