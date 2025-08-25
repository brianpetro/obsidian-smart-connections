# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Test
```bash
# Build the plugin (outputs to dist/)
npm run build

# Run all tests
npm test

# Run specific test file
npx ava src/utils/banner.test.js

# Run tests in watch mode
npx ava --watch

# Create release package
npm run release
```

### Development Setup
For hot-reload development, set `DESTINATION_VAULTS` environment variable in `.env`:
```bash
DESTINATION_VAULTS=your-vault-name,another-vault
```
This copies build artifacts to `.obsidian/plugins/smart-connections/` in specified vaults.

## Architecture Overview

### Core System: Smart Environment (SmartEnv)
The plugin centers around `SmartEnv` - a unified environment managing all features:
- **Collections**: `smart_sources`, `smart_blocks`, `smart_threads`, `smart_messages`
- **Initialization**: `Plugin.onload()` → `Plugin.initialize()` → `new SmartEnv()`
- **Data Storage**: `.smart-env/` directory (embeddings, indexes) + Obsidian plugin data

### Modular Dependency Structure
This is part of the JSBrains ecosystem with local file dependencies:
```
obsidian-smart-connections/
├── ../jsbrains/          # Core smart-* packages
│   ├── smart-blocks/
│   ├── smart-collections/
│   ├── smart-embed-model/
│   └── ...
├── ../smart-chat-obsidian/
└── ../smart-context-obsidian/
```

**Key insight**: Development requires this specific directory structure. All `file:../` dependencies must exist locally.

### Two Main Features

#### 1. Smart Connections (Semantic Search)
- **Purpose**: Find semantically related content using embeddings
- **Components**: `connections`, `connections_results`, `lookup`
- **Default Model**: Transformers.js with 'TaylorAI/bge-micro-v2' (local, no API required)
- **View**: `ConnectionsView` in side panel

#### 2. Smart Chat (AI Conversations)
- **Purpose**: Chat with AI using vault content as context
- **Components**: Threads, messages, context retrieval
- **Providers**: OpenAI, Anthropic, Google, Ollama, LM Studio, etc.
- **View**: `SmartChatView` with file/folder references

### Configuration System
Merges multiple configs hierarchically:
1. `smart_env.config.js` (root) - Base configuration
2. `src/smart_env.config.js` - Plugin-specific overrides
3. External package configs - Smart Chat, Smart Context additions

### Component Rendering
Uses a unified rendering system:
```javascript
// Components registered in config, rendered via:
env.render_component(container, component_key, opts);
```

### View Architecture
All views extend `SmartObsidianView`:
1. Register with Obsidian workspace
2. Wait for SmartEnv to load
3. Render components
4. Handle events (file changes, user interactions)

## Testing Strategy
- **Framework**: AVA v6 with ES modules
- **Pattern**: Co-located tests (`*.test.js` alongside source files)
- **Coverage**: Mainly utilities and converters; core plugin logic lacks tests

## Build System
- **Bundler**: esbuild with custom plugins (CSS with attributes, markdown)
- **Target**: ES2022, CommonJS format for Obsidian
- **External**: Obsidian API, Transformers.js, Node built-ins
- **Output**: `dist/main.js`, `manifest.json`, `styles.css`

## Key Development Patterns

### Adapter Pattern
Platform/provider-specific adapters bridge generic modules to Obsidian:
- `SmartHttpObsidianRequestAdapter`
- `SmartFsObsidianAdapter`
- AI provider adapters (OpenAI, Anthropic, etc.)

### Event-Driven Updates
- File changes trigger re-embedding
- Active leaf changes update connections view
- Settings changes propagate through SmartEnv

### Settings Management
- Main settings in `sc_settings_tab.js`
- Per-feature settings (chat, connections, environment)
- Stored in Obsidian's plugin data system

## Important Considerations

1. **Privacy First**: Default configuration uses local models (no API keys required)
2. **Modular Architecture**: Each smart-* package is independently versioned
3. **Embedding Storage**: JSON files in `.smart-env/` should be excluded from sync
4. **Version Updates**: `manifest.json` version syncs with `package.json` during build
5. **Release Notes**: Automatically imported from `releases/[version].md` if exists