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

### Claude Code Integration Testing
```bash
# Test Claude Code CLI availability
claude --version

# Test Claude Code adapter directly
npx ava src/adapters/claude_code_cli_adapter.test.js

# Test with specific vault context
npx ava src/adapters/claude_code_cli_adapter.test.js -v

# Run integration tests
npm run test:claude-code

# Test performance with large context
npm run test:claude-code:performance
```

### Development Setup
For hot-reload development, set `DESTINATION_VAULTS` environment variable in `.env`:
```bash
DESTINATION_VAULTS=your-vault-name,another-vault
```
This copies build artifacts to `.obsidian/plugins/smart-connections/` in specified vaults.

### Claude Code Development Environment
For testing Claude Code integration specifically:
```bash
# Set up test environment
export CLAUDE_CODE_TEST=true
export SMART_CONNECTIONS_TEST_VAULT=/path/to/test/vault

# Run Claude Code integration tests
npm run test:integration:claude-code

# Debug Claude Code adapter
DEBUG=smart-connections:claude-code npm test

# Test with different vault sizes
npm run test:claude-code:small-vault
npm run test:claude-code:large-vault
```

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
- **Default Provider**: Claude Code CLI (local, private, cost-free)
- **Alternative Providers**: OpenAI, Anthropic, Google, Ollama, LM Studio, etc.
- **View**: `SmartChatView` with file/folder references

### Claude Code CLI Integration
New privacy-first AI integration that runs completely locally:

#### Architecture
```
User Input → Smart Connections → Context Search → Claude Code CLI → Local Processing → Response
```

#### Key Components
- **`ClaudeCodeCLIAdapter`**: Main adapter class in `src/adapters/claude_code_cli_adapter.js`
- **Context Intelligence**: Automatically includes relevant vault content
- **Process Management**: Spawns and manages CLI processes with timeout/retry logic
- **Streaming Support**: Real-time response streaming for better UX

#### Integration Points
1. **Model Registration**: Registered as a chat model in Smart Environment config
2. **Settings UI**: Configurable through Smart Connections settings
3. **Context Pipeline**: Leverages existing semantic search infrastructure
4. **Error Handling**: Robust retry logic with user feedback

### Configuration System
Merges multiple configs hierarchically:
1. `smart_env.config.js` (root) - Base configuration
2. `src/smart_env.config.js` - Plugin-specific overrides
3. External package configs - Smart Chat, Smart Context additions
4. **Claude Code config** - Local CLI adapter settings

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
- **Claude Code Testing**: Dedicated test suite for CLI adapter functionality

### Claude Code Test Categories
1. **Unit Tests**: Individual adapter methods
2. **Integration Tests**: Full context pipeline
3. **Performance Tests**: Large vault scenarios
4. **Error Handling Tests**: CLI failure scenarios
5. **Security Tests**: Data isolation verification

## Build System
- **Bundler**: esbuild with custom plugins (CSS with attributes, markdown)
- **Target**: ES2022, CommonJS format for Obsidian
- **External**: Obsidian API, Transformers.js, Node built-ins, **Claude Code CLI**
- **Output**: `dist/main.js`, `manifest.json`, `styles.css`

## Key Development Patterns

### Adapter Pattern
Platform/provider-specific adapters bridge generic modules to Obsidian:
- `SmartHttpObsidianRequestAdapter`
- `SmartFsObsidianAdapter`
- **`ClaudeCodeCLIAdapter`** - Local CLI integration
- AI provider adapters (OpenAI, Anthropic, etc.)

### Event-Driven Updates
- File changes trigger re-embedding
- Active leaf changes update connections view
- Settings changes propagate through SmartEnv
- **Claude Code process lifecycle events**

### Settings Management
- Main settings in `sc_settings_tab.js`
- Per-feature settings (chat, connections, environment)
- **Claude Code specific settings** (timeout, retries, context limits)
- Stored in Obsidian's plugin data system

## Important Considerations

1. **Privacy First**: Default configuration uses local models (no API keys required)
   - **Claude Code CLI**: Ultimate privacy with local processing
   - All data stays on user's machine
2. **Modular Architecture**: Each smart-* package is independently versioned
3. **Embedding Storage**: JSON files in `.smart-env/` should be excluded from sync
4. **Version Updates**: `manifest.json` version syncs with `package.json` during build
5. **Release Notes**: Automatically imported from `releases/[version].md` if exists
6. **Claude Code Dependencies**: Ensure CLI availability and proper PATH configuration

## Claude Code Development Guidelines

### Testing Claude Code Integration
Always test Claude Code functionality with:
1. **CLI Availability**: Verify `claude --version` works
2. **Permission Handling**: Test file system permissions
3. **Context Size Limits**: Test with varying vault sizes
4. **Error Scenarios**: Network issues, CLI crashes, timeouts
5. **Performance**: Measure response times and resource usage

### Debugging Claude Code Issues
Common debugging approaches:
```bash
# Enable debug logging
DEBUG=smart-connections:claude-code npm run dev

# Test CLI directly
claude --help
echo "test prompt" | claude

# Monitor process activity
ps aux | grep claude
htop -p $(pgrep claude)
```

### Performance Considerations
- Context size directly impacts performance
- Semantic search results should be filtered for relevance
- CLI process cleanup is critical for memory management
- Streaming responses improve perceived performance

### Security & Privacy
- Never log sensitive content
- Ensure proper process isolation
- Clean up temporary files
- Verify no network calls during processing

## Local-First Development Workflows

With Claude Code CLI as the default provider, Smart Connections now follows a **local-first philosophy**:

### Core Principles
1. **Privacy by Default**: All AI processing happens locally
2. **No External Dependencies**: Works completely offline after setup  
3. **Zero API Costs**: Unlimited usage without subscription fees
4. **Seamless Migration**: Easy transition from external APIs

### Development Workflow
```bash
# 1. Set up local environment
claude --version  # Verify CLI installation

# 2. Test Smart Connections integration
npx ava src/test/migration_manager.test.js  # Test migration system
npx ava src/adapters/claude_code_cli_adapter.test.js  # Test adapter

# 3. Build and test locally
npm run build
npm test

# 4. Test with real vault
# Copy to .obsidian/plugins/smart-connections/ for testing
```

### Migration Strategy for Users
Smart Connections now includes **intelligent migration** from external APIs:

1. **Automatic Detection**: Identifies users with existing API configurations
2. **Smart Suggestion**: Proactively suggests migration with benefits explanation
3. **One-Click Migration**: Seamless transition preserving chat history
4. **Safe Rollback**: Easy return to external APIs if needed

### Configuration Priorities
```javascript
// Config hierarchy (highest to lowest priority):
1. Claude Code CLI (default, local)
2. Other local providers (Ollama, LM Studio)
3. External APIs (OpenAI, Anthropic) - fallback only
```

### User Experience Philosophy
- **Setup**: First-run experience guides Claude CLI installation
- **Migration**: Proactive suggestions with clear benefits
- **Fallback**: External APIs remain available as alternatives
- **Privacy**: Local processing prominently featured in UI

### Implementation Notes
- **MigrationManager**: Handles API-to-local transitions (`src/utils/migration_manager.js`)
- **MigrationConfirmationModal**: User-friendly migration interface (`src/modals/migration_confirmation_modal.js`)
- **FirstRunManager**: Guides new users through Claude CLI setup
- **Enhanced Settings**: Local-first UI with clear privacy indicators