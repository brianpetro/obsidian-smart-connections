# Smart Connections Architecture

## System Overview

Smart Connections is built on a modular, event-driven architecture that bridges Obsidian's plugin API with the JSBrains ecosystem for AI-powered knowledge management.

```
┌─────────────────────────────────────────────────────────────┐
│                     Obsidian Application                     │
├─────────────────────────────────────────────────────────────┤
│                  Smart Connections Plugin                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  SmartEnv Core                      │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  │   │
│  │  │ Collections │  │    Models    │  │  Views   │  │   │
│  │  └─────────────┘  └──────────────┘  └──────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    JSBrains Ecosystem                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Smart   │  │  Smart   │  │  Smart   │  │  Smart   │   │
│  │  Blocks  │  │ Sources  │  │  Embed   │  │   Chat   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├─────────────────────────────────────────────────────────────┤
│                     Local AI Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Claude Code │  │Transformers.js│  │   Ollama     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Plugin Entry Point (`src/index.js`)
- **SmartConnectionsPlugin**: Main Obsidian plugin class
- Lifecycle management (onload, initialize, onunload)
- View registration and management
- Settings tab integration
- Event coordination

### 2. Smart Environment (`SmartEnv`)
- Central orchestration hub for all features
- Manages collections, models, and views
- Configuration merging from multiple sources
- Component rendering pipeline
- Event bus for inter-component communication

### 3. Collections System

#### Data Collections
- **smart_sources**: Note files and their embeddings
- **smart_blocks**: Block-level content with embeddings
- **smart_threads**: Chat conversation threads
- **smart_messages**: Individual chat messages

#### Storage Adapters
- **AjsonMultiFileCollectionDataAdapter**: Scalable JSON storage
- **EnvJsonThreadSourceAdapter**: Thread persistence
- File-based storage in `.smart-env/` directory

### 4. View Architecture

All views extend `SmartObsidianView`:

#### Primary Views
- **ConnectionsView**: Semantic search results panel
- **SmartChatView**: Conversational AI interface
- **ScLookupView**: Quick note lookup
- **SmartChatGPTView**: Legacy chat interface

#### View Lifecycle
1. Register with Obsidian workspace
2. Wait for SmartEnv initialization
3. Render components via unified system
4. Handle events (file changes, user input)

### 5. Component System

Unified rendering through configuration:
```javascript
env.render_component(container, component_key, opts)
```

#### Core Components
- **connections**: Main connections interface
- **connections_results**: Search results display
- **lookup**: Quick search component
- **thread**: Chat conversation display
- **source_inspector**: Content debugging tool

### 6. Adapter Pattern

Platform-specific bridges between generic modules and Obsidian:

#### System Adapters
- **SmartFsObsidianAdapter**: File system operations
- **SmartHttpObsidianRequestAdapter**: HTTP requests
- **SmartViewObsidianAdapter**: View rendering

#### AI Model Adapters
- **ClaudeCodeCLIAdapter**: Local Claude processing
- **SmartChatModelOllamaAdapter**: Ollama integration
- **SmartChatModelLmStudioAdapter**: LM Studio bridge
- **TransformersJsAdapter**: Local embeddings

## Data Flow

### Semantic Search Pipeline
```
User Query
    ↓
Parse & Tokenize
    ↓
Generate Embedding (Transformers.js)
    ↓
Vector Similarity Search
    ↓
Rank Results by Score
    ↓
Render in ConnectionsView
```

### Chat Conversation Flow
```
User Message
    ↓
Context Retrieval (Smart Connections)
    ↓
Format with Context
    ↓
Send to AI Model (Claude Code CLI)
    ↓
Stream Response
    ↓
Update Thread & Display
```

### File Processing Pipeline
```
File Change Event
    ↓
Parse Content (Smart Sources)
    ↓
Extract Blocks
    ↓
Generate Embeddings
    ↓
Store in Collections
    ↓
Update Indexes
```

## Configuration Architecture

### Hierarchical Config Merging
1. **Base Config**: `smart_env.config.js` (root)
2. **Plugin Config**: `src/smart_env.config.js`
3. **Package Configs**: Smart Chat, Smart Context
4. **User Settings**: Obsidian settings interface
5. **Runtime Overrides**: Dynamic configuration

### Configuration Sections
- **collections**: Data collection settings
- **item_types**: Entity class mappings
- **modules**: AI model configurations
- **components**: UI component registry
- **adapters**: Platform-specific implementations

## Event System

### Core Events
- **smart-env:loaded**: Environment initialization complete
- **smart-sources:changed**: File modifications detected
- **smart-embed:complete**: Embedding generation finished
- **smart-chat:message**: New chat message received
- **smart-connections:refresh**: Update search results

### Event Flow
1. Obsidian triggers vault events
2. Plugin captures and transforms events
3. SmartEnv broadcasts to collections
4. Components react and update UI
5. Models process as needed

## Performance Optimizations

### Lazy Loading
- Components load on-demand
- Models initialize when first used
- Views defer rendering until visible

### Caching Strategy
- Embedding results cached in AJSON files
- Search results cached temporarily
- Chat context cached per session
- Component state preserved

### Resource Management
- Process pooling for Claude Code CLI
- Batch embedding generation
- Debounced file change processing
- Efficient vector similarity algorithms

## Security Architecture

### Data Isolation
- All data stored within vault directory
- No external data transmission by default
- Clear boundaries between user data and plugin code

### Process Security
- Claude Code CLI runs in isolated process
- Input sanitization for all user data
- No execution of arbitrary code
- Secure IPC communication

### Privacy Guarantees
- Local-first processing
- Opt-in for any external services
- No telemetry or analytics
- Transparent data handling

## Extension Points

### Adding New AI Models
1. Create adapter extending base class
2. Register in `smart_env.config.js`
3. Add settings UI component
4. Implement streaming interface

### Creating Custom Components
1. Define render function
2. Register in component registry
3. Add to view configuration
4. Handle component events

### Extending Collections
1. Define entity class
2. Create data adapter if needed
3. Register in collections config
4. Implement processing logic

## Build Architecture

### Build Pipeline
```
Source Files
    ↓
esbuild Bundling
    ↓
Custom CSS Plugin
    ↓
Markdown Plugin
    ↓
Tree Shaking
    ↓
Output to dist/
```

### Output Structure
```
dist/
├── main.js         # Bundled plugin code
├── manifest.json   # Plugin metadata
└── styles.css      # Compiled styles
```

## Testing Architecture

### Test Organization
- Co-located tests (`*.test.js`)
- Integration tests in `src/test/`
- Performance tests in `scripts/`

### Test Categories
- **Unit Tests**: Individual functions
- **Integration Tests**: Feature workflows
- **Performance Tests**: Load and speed
- **E2E Tests**: Full user scenarios

---

*This architecture prioritizes modularity, performance, and privacy while maintaining flexibility for future enhancements.*