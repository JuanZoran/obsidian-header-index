# Minimal Obsidian Plugin

Lightweight starter plugin that only logs to the console when it loads and unloads. Use this as a clean base for building your own features.

## Development
- `npm install`
- `npm run dev` for watch mode (outputs to `build/`)
- `npm run build` for a production bundle (artifacts in `build/`)

## Testing in Obsidian
- After building, copy `build/main.js`, `build/manifest.json`, and `build/styles.css` (if used) to `<Vault>/.obsidian/plugins/sample-plugin/`
- Reload Obsidian and enable the plugin via **Settings → Community plugins**

## Notes
- Check the developer console to see the load/unload log messages
- Node 18+ recommended (matches current LTS)
