# Smart Connections Technology Stack

## Current Architecture (v3.0.78)

### Core Platform
- **Obsidian Plugin API** `^1.1.0` - Desktop and mobile compatibility
- **JavaScript ES2022** - Modern language features with ES modules
- **Node.js Platform** - Build and development environment

### Build System
- **esbuild** `^0.23.1` - High-performance bundler
  - Custom CSS plugin for `import sheet from './style.css' with { type: 'css' }`
  - Custom markdown plugin for `import md from './content.md' with { type: 'markdown' }`
  - CommonJS output format for Obsidian compatibility
  - Tree shaking and minification
- **Manifest Sync** - Auto-updates version from package.json

### Testing Framework  
- **AVA** `^6.0.1` - Modern test runner with ES module support
- **Co-located Tests** - `*.test.js` files alongside source code
- **Test Patterns** - Utilities and converters have comprehensive coverage

### AI & Embeddings (Current)
- **Transformers.js** `@xenova/transformers@latest` - Local embedding generation
- **TaylorAI/bge-micro-v2** - Default embedding model (384 dimensions)
- **js-tiktoken** `^1.0.19` - Token counting for context management
- **Local Processing** - Zero external API dependencies by default

### JSBrains Ecosystem (Local Dependencies)
```
../jsbrains/
├── smart-blocks/          # Note block processing
├── smart-chat-model/      # Chat provider abstractions
├── smart-chunks/          # Text chunking utilities  
├── smart-collections/     # Data storage and retrieval
├── smart-embed-model/     # Embedding model management
├── smart-entities/        # Entity relationship handling
├── smart-file-system/     # File system abstractions
├── smart-http-request/    # HTTP client with adapters
├── smart-instruct-model/  # Instruction following models
├── smart-model/          # Base model abstractions
├── smart-notices/        # User notification system
├── smart-settings/       # Configuration management
├── smart-sources/        # Content source handling
├── smart-utils/          # Shared utilities
└── smart-view/           # UI component framework

../obsidian-smart-env/     # Obsidian-specific environment
../smart-chat-obsidian/    # Chat interface for Obsidian  
../smart-context-obsidian/ # Context management for Obsidian
```

### Data Storage
- **AJSON Multi-File** - Collection data adapter for scalable storage
- **Smart Environment Directory** - `.smart-env/` for embeddings and indexes
- **Obsidian Plugin Data** - Settings and configuration via Obsidian API

### Current AI Providers (To Be Replaced)
- **OpenAI** - GPT models via API
- **Anthropic** - Claude models via API  
- **Google** - Gemini models via API
- **Ollama** - Local model server
- **LM Studio** - Local model interface
- **Groq** - Fast inference API
- **Azure OpenAI** - Enterprise GPT access
- **DeepSeek** - Alternative API provider
- **OpenRouter** - Multi-provider routing
- **Custom Endpoints** - User-defined APIs

---

## Target Architecture (Claude Code Integration)

### AI Intelligence (Planned)
- **Claude Code** - Local AI processing (replaces all API providers)
- **Direct Integration** - Native communication with Claude Code CLI
- **Offline Operation** - Complete functionality without internet
- **Context Bridging** - Efficient vault context feeding to Claude Code

### Simplified Dependencies (Planned)
Remove or consolidate JSBrains packages that are no longer needed:

**Keep Essential**:
- `smart-collections` - Data storage
- `smart-file-system` - File operations  
- `smart-embed-model` - Local embeddings
- `smart-sources` - Content processing
- `smart-view` - UI components
- `obsidian-smart-env` - Core environment

**Remove/Replace**:
- `smart-chat-model` + all adapters → Claude Code bridge
- `smart-http-request` → Not needed for local processing
- Provider-specific packages → Consolidated local processing

### Enhanced Local Processing
- **Claude Code CLI** - Direct local AI execution
- **Process Communication** - Efficient data exchange with Claude Code
- **Context Management** - Optimized vault content delivery
- **Response Processing** - Handle Claude Code outputs natively

---

## Development Environment

### Development Dependencies
- **@xenova/transformers** `latest` - AI model runtime
- **archiver** `^6.0.1` - Release packaging
- **ava** `^6.0.1` - Test framework
- **axios** `^1.6.7` - HTTP client (dev tools)
- **dotenv** `^16.3.1` - Environment configuration
- **esbuild** `^0.23.1` - Build system
- **swagger-jsdoc** `^6.2.8` - API documentation

### Hot Reload Development
- **DESTINATION_VAULTS** - Environment variable for development vaults
- **Auto-copy** - Build artifacts to `.obsidian/plugins/smart-connections/`
- **.hotreload** - File for development mode detection

### Release System
- **Automated Versioning** - Sync package.json with manifest.json
- **Release Notes** - Import from `releases/[version].md` files
- **Archive Creation** - Zip plugin files for distribution

---

## Data Architecture

### File System Structure
```
vault/
├── .obsidian/
│   └── plugins/
│       └── smart-connections/          # Plugin installation
│           ├── main.js
│           ├── manifest.json
│           └── styles.css
└── .smart-env/                         # Data directory
    ├── smart_sources.json              # Source embeddings
    ├── collections/                    # Collection data
    └── indexes/                        # Search indexes
```

### Configuration Hierarchy
1. `smart_env.config.js` (root) - Base configuration
2. `src/smart_env.config.js` - Plugin-specific settings  
3. External package configs - Smart Chat, Smart Context
4. User settings - Via Obsidian settings tabs

### Component System
- **Unified Rendering** - `env.render_component(container, component_key, opts)`
- **Component Registration** - Config-based component mapping
- **Event-Driven Updates** - File changes trigger re-rendering

---

## Security & Privacy

### Current Approach
- **Local-First** - Default embedding model runs offline
- **Optional APIs** - External providers require explicit configuration
- **No Telemetry** - No automatic data collection or transmission
- **File System Access** - Limited to vault directory

### Enhanced Privacy (Claude Code)
- **Zero External Calls** - All AI processing local
- **Data Sovereignty** - Complete control over information
- **Audit Trail** - Clear understanding of all processing
- **Offline Operation** - Internet connectivity not required

---

## Performance Characteristics

### Current Performance
- **Bundle Size** - ~1MB with minimal dependencies
- **Memory Usage** - Efficient with local embedding models
- **Startup Time** - Fast initialization with lazy loading
- **Mobile Support** - Optimized for mobile devices

### Target Performance (Claude Code)
- **Reduced Overhead** - Fewer dependencies and network calls
- **Local Processing Speed** - Optimized for single-user workflows
- **Context Efficiency** - Smart context selection for Claude Code
- **Responsive UI** - Non-blocking AI operations

---

*This technology stack emphasizes local-first processing while maintaining the flexibility to evolve with your personal workflow needs.*