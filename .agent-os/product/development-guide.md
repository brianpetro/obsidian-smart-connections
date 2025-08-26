# Smart Connections Development Guide

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Obsidian desktop app
- Git for version control
- Claude Code CLI (for local AI features)

### Directory Structure Setup
Smart Connections requires a specific directory structure due to local file dependencies:

```bash
# Required directory structure
parent-directory/
├── obsidian-smart-connections/    # This repository
├── jsbrains/                      # JSBrains ecosystem packages
│   ├── smart-blocks/
│   ├── smart-collections/
│   ├── smart-embed-model/
│   └── ...
├── smart-chat-obsidian/
├── smart-context-obsidian/
└── obsidian-smart-env/
```

### Initial Setup
```bash
# Clone the main repository
git clone https://github.com/brianpetro/obsidian-smart-connections.git

# Clone dependencies (in parent directory)
cd ..
git clone [jsbrains repositories]
git clone [smart-chat-obsidian repository]
git clone [smart-context-obsidian repository]

# Install dependencies
cd obsidian-smart-connections
npm install

# Build the plugin
npm run build
```

### Development Environment
Create a `.env` file for hot-reload development:
```bash
# .env
DESTINATION_VAULTS=your-test-vault-name
```

This automatically copies build artifacts to your vault's plugin directory.

## Development Workflow

### 1. Understanding the Codebase

#### Entry Points
- `src/index.js` - Main plugin class
- `src/smart_env.config.js` - Configuration
- `smart-chat-v0/components/thread.js` - Chat UI

#### Key Patterns
- **Adapter Pattern**: Platform-specific implementations
- **Component System**: Unified rendering pipeline
- **Event-Driven Updates**: Reactive UI updates
- **Collection-Based Storage**: AJSON data persistence

### 2. Making Changes

#### Adding a New Feature
1. Identify the appropriate module/component
2. Follow existing patterns in that module
3. Update configuration if needed
4. Add tests for new functionality
5. Update documentation

#### Code Style Guidelines
```javascript
// Use ES modules
import { ClassName } from './module.js';

// Async/await over promises
async function processData() {
  const result = await fetchData();
  return transform(result);
}

// Descriptive variable names
const semanticSearchResults = await findSimilarNotes(query);

// Guard clauses for early returns
if (!isValid(input)) return null;

// Component rendering pattern
export function render(container, opts = {}) {
  const { env, data } = opts;
  // rendering logic
}
```

### 3. Working with Claude Code CLI Integration

#### Understanding the Adapter
The Claude Code CLI adapter (`src/adapters/claude_code_cli_adapter.js`) bridges Smart Connections with local Claude:

```javascript
// Key methods to understand
class ClaudeCodeCLIAdapter {
  async count_tokens(messages) { /* ... */ }
  async stream_chat_completion(messages) { /* ... */ }
  prepare_messages_with_context(messages, env) { /* ... */ }
}
```

#### Testing Claude Code Features
```bash
# Run Claude-specific tests
npm run test:claude

# Integration tests
npm run test:claude-integration

# Performance testing
npm run perf:claude

# End-to-end tests
npm run e2e:claude
```

### 4. Working with Collections

#### Understanding Collections
Collections manage data storage and retrieval:

```javascript
// Access collections
const sources = env.smart_sources;
const blocks = env.smart_blocks;

// Query collections
const results = await sources.search(query);

// Update collections
await sources.save_item(item);
```

#### Adding New Collection Types
1. Define entity class in `item_types`
2. Configure in `collections` section
3. Set up data adapter
4. Implement required methods

### 5. Building and Testing

#### Build Commands
```bash
# Standard build
npm run build

# Create release package
npm run release

# Run all tests
npm test

# Run specific test file
npx ava src/utils/banner.test.js

# Watch mode for development
npx ava --watch
```

#### Testing Best Practices
- Co-locate tests with source files
- Test edge cases and error conditions
- Mock external dependencies
- Use descriptive test names

## Common Development Tasks

### Adding a New AI Model Provider

1. Create adapter in `src/adapters/`:
```javascript
export class MyModelAdapter extends SmartChatModelAdapter {
  async stream_chat_completion(messages, opts = {}) {
    // Implementation
  }
}
```

2. Register in `src/smart_env.config.js`:
```javascript
modules: {
  smart_chat_model: {
    adapters: {
      my_model: MyModelAdapter
    }
  }
}
```

3. Add settings UI component
4. Test thoroughly

### Modifying the Chat Interface

1. Locate component in `smart-chat-v0/components/`
2. Follow existing render pattern:
```javascript
export function render(container, opts = {}) {
  const { env, thread } = opts;
  // Update DOM
}
```

3. Handle events appropriately
4. Test UI changes manually

### Optimizing Semantic Search

1. Review `src/bases/cos_sim.js` for algorithm
2. Adjust in `src/components/connections.js`:
```javascript
// Tune search parameters
const results = await this.env.smart_sources.search({
  query: embedding,
  limit: 20,
  threshold: 0.7
});
```

3. Test with various vault sizes
4. Profile performance

## Debugging

### Debug Logging
```javascript
// Add debug statements
console.log('[SmartConnections]', 'Debug message', data);

// Conditional debugging
if (this.env.DEBUG) {
  console.log('Detailed debug info', complexObject);
}
```

### Chrome DevTools
1. Open Obsidian Developer Console (Ctrl+Shift+I)
2. Set breakpoints in Sources tab
3. Use Network tab for API calls
4. Profile with Performance tab

### Common Issues

#### Build Failures
- Ensure all local dependencies exist
- Check Node.js version compatibility
- Clear `node_modules` and reinstall

#### Runtime Errors
- Check console for stack traces
- Verify SmartEnv initialization
- Ensure collections are loaded

#### Claude Code CLI Issues
- Verify CLI installation: `claude --version`
- Check PATH configuration
- Review adapter timeout settings

## Performance Optimization

### Profiling
```javascript
// Time critical operations
console.time('embedding-generation');
await generateEmbedding(text);
console.timeEnd('embedding-generation');
```

### Memory Management
- Clear unused embeddings periodically
- Limit collection cache sizes
- Use streaming for large responses

### Optimization Techniques
- Debounce file change events
- Batch embedding operations
- Implement progressive rendering
- Cache computed results

## Release Process

### Version Update
1. Update version in `package.json`
2. Create release notes in `releases/[version].md`
3. Run build: `npm run build`
4. Test thoroughly

### Creating Release
```bash
# Generate release package
npm run release

# This creates a zip file with:
# - dist/main.js
# - manifest.json
# - styles.css
```

### Publishing
1. Create GitHub release
2. Upload generated zip file
3. Update plugin in Obsidian community plugins (if applicable)

## Best Practices

### Code Quality
- Write self-documenting code
- Keep functions small and focused
- Use meaningful variable names
- Add comments for complex logic

### Performance
- Profile before optimizing
- Measure impact of changes
- Consider mobile constraints
- Optimize for common cases

### User Experience
- Provide clear feedback
- Handle errors gracefully
- Make features discoverable
- Respect user preferences

### Security
- Validate all inputs
- Sanitize user content
- Avoid eval() and similar
- Keep dependencies updated

## Contributing

### Before Starting
1. Check existing issues/PRs
2. Discuss major changes first
3. Follow existing patterns
4. Write tests for new code

### Commit Messages
```
feat: Add Claude Code streaming support
fix: Resolve embedding cache issue
docs: Update development guide
test: Add adapter unit tests
refactor: Simplify connection scoring
```

### Pull Request Process
1. Branch from main
2. Make focused changes
3. Update tests and docs
4. Submit PR with description
5. Address review feedback

---

*This guide helps you navigate and contribute to Smart Connections. For specific questions, consult the codebase or reach out to the community.*