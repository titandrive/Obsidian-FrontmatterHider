# Frontmatter Hider

Frontmatter Hider is a simple Obsidian plugin that lets you toggle frontmatter visibility on a per-note basis.

## How it works

Frontmatter Hider uses CSS to hide frontmatter on individual notes. You can toggle visibility via the ribbon button, right-click context menu, or command palette. Your hidden/shown preferences are saved and persist across restarts.

You can hide frontmatter independently across all three Obsidian view modes:
- **Source mode**
- **Live Preview**
- **Reading mode**

### Toggling frontmatter

There are several ways to toggle frontmatter visibility:

- **Ribbon button:** Click the eye icon in the left ribbon to toggle the current note
- **Right-click menu:** Right-click any file or folder in the file explorer to show/hide frontmatter
- **Multi-select:** Select multiple files in the file explorer, then right-click or use the ribbon button
- **Command palette:** Use `Toggle frontmatter visibility` to toggle the current note or explorer selection
- **Folders:** Right-click a folder to toggle all markdown files within it

### Toggle logic

When toggling multiple files at once, if all selected files are already hidden, they will all be shown. Otherwise, they will all be hidden.

## Installation

Frontmatter Hider can be installed either via the BRAT Plugin (recommended) or manually.

### BRAT Installation
Using BRAT is the recommended, and easiest, way to install Obsidian plugins that are not available in the Obsidian Community Store.

1. Install BRAT via community plugins.
2. Open BRAT and select "Add Beta Plugin"
3. Paste `https://github.com/titandrive/Obsidian-FrontmatterHider` into the text bar
4. Click "Add Plugin"

Frontmatter Hider is now installed and BRAT will automatically keep track of updates for you.

### Manual Installation
1. Browse to Frontmatter Hider [Releases](https://github.com/titandrive/Obsidian-FrontmatterHider/releases)
2. Download the latest release
3. Extract the release and copy it to your obsidian vault: `.../MyVault/.obsidian/plugins/frontmatter-hider`
4. Restart Obsidian
5. Enable Frontmatter Hider in Settings/Community Plugins

## Settings

Frontmatter Hider works without any configuration. There are only a few settings:

- **Source mode:** Whether to hide frontmatter in source mode (Default: on)
- **Live Preview:** Whether to hide frontmatter in live preview mode (Default: on)
- **Reading mode:** Whether to hide frontmatter in reading mode (Default: on)
- **Show ribbon icon:** Show/hide the toggle button in the left ribbon (Default: on)

## AI Disclosure
This plugin was made with the assistance of Claude Code.

## License
MIT
