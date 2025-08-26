# Smart Connections Best Practices

## Architecture Principles

### 1. Modular Independence
Each module should be self-contained and usable independently:
```javascript
// Good: Module with clear boundaries
export class SmartCollection {
  constructor(env) {
    this.env = env;
    this.items = new Map();
  }
  
  async load() {
    // Self-contained loading logic
  }
}

// Bad: Module with external dependencies scattered
class Collection {
  async load() {
    // Reaches into global state
    const data = window.smartConnections.getData();
  }
}
```

### 2. Adapter Pattern for Platform Abstraction
Always use adapters to bridge platform-specific implementations:
```javascript
// Platform-agnostic interface
class SmartFs {
  constructor(adapter) {
    this.adapter = adapter;
  }
  
  async read(path) {
    return this.adapter.read(path);
  }
}

// Obsidian-specific implementation
class SmartFsObsidianAdapter {
  constructor(app) {
    this.app = app;
  }
  
  async read(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    return await this.app.vault.read(file);
  }
}
```

### 3. Event-Driven Communication
Use events for loose coupling between components:
```javascript
// Emit events for state changes
class SmartSources extends SmartCollection {
  async update_item(key, data) {
    await super.update_item(key, data);
    this.env.emit('smart-sources:updated', { key, data });
  }
}

// Listen to events in dependent components
class ConnectionsView {
  constructor(env) {
    env.on('smart-sources:updated', this.refresh.bind(this));
  }
}
```

## Data Management

### 1. Collection-Based Storage
Use collections for organized data management:
```javascript
// Define clear collection structure
const collections_config = {
  smart_sources: {
    class: SmartSources,
    data_adapter: AjsonMultiFileCollectionDataAdapter,
    process_embed_queue: true
  },
  smart_blocks: {
    class: SmartBlocks,
    data_adapter: AjsonMultiFileCollectionDataAdapter
  }
};
```

### 2. Lazy Loading Strategy
Load data only when needed:
```javascript
class SmartEnv {
  get smart_sources() {
    if (!this._smart_sources) {
      this._smart_sources = new SmartSources(this);
      this._smart_sources.load(); // Async load in background
    }
    return this._smart_sources;
  }
}
```

### 3. Efficient Caching
Cache expensive computations:
```javascript
class EmbeddingCache {
  constructor() {
    this.cache = new Map();
    this.max_size = 1000;
  }
  
  get(text) {
    const hash = this.hash(text);
    if (this.cache.has(hash)) {
      // Move to end (LRU)
      const value = this.cache.get(hash);
      this.cache.delete(hash);
      this.cache.set(hash, value);
      return value;
    }
    return null;
  }
  
  set(text, embedding) {
    if (this.cache.size >= this.max_size) {
      // Remove oldest
      const first = this.cache.keys().next().value;
      this.cache.delete(first);
    }
    this.cache.set(this.hash(text), embedding);
  }
}
```

## Error Handling

### 1. Graceful Degradation
Always provide fallbacks:
```javascript
async function get_embedding(text) {
  try {
    // Try primary method
    return await this.embed_model.generate(text);
  } catch (error) {
    console.warn('Primary embedding failed, trying fallback', error);
    try {
      // Try fallback method
      return await this.fallback_embed(text);
    } catch (fallback_error) {
      console.error('All embedding methods failed', fallback_error);
      // Return null vector as last resort
      return new Array(384).fill(0);
    }
  }
}
```

### 2. User-Friendly Error Messages
Provide actionable error messages:
```javascript
class ClaudeCodeCLIAdapter {
  async validate_installation() {
    try {
      await exec('claude --version');
    } catch (error) {
      throw new Error(
        'Claude Code CLI not found. Please install it:\n' +
        'npm install -g @anthropic-ai/claude-code\n' +
        'Or download from https://claude.ai/code'
      );
    }
  }
}
```

## Performance Optimization

### 1. Debounce Expensive Operations
Prevent excessive processing:
```javascript
class FileWatcher {
  constructor() {
    this.process_changes = debounce(
      this._process_changes.bind(this),
      500
    );
  }
  
  on_file_change(file) {
    this.pending_files.add(file);
    this.process_changes();
  }
  
  async _process_changes() {
    const files = [...this.pending_files];
    this.pending_files.clear();
    await this.batch_process(files);
  }
}
```

### 2. Streaming for Large Data
Use streaming to prevent memory issues:
```javascript
async function* stream_chat_response(messages) {
  const process = spawn('claude', ['--stream']);
  
  for await (const chunk of process.stdout) {
    const delta = parse_delta(chunk);
    if (delta) yield delta;
  }
}

// Usage
for await (const delta of stream_chat_response(messages)) {
  display_partial(delta);
}
```

### 3. Progressive Enhancement
Load features progressively:
```javascript
class SmartConnectionsPlugin extends Plugin {
  async onload() {
    // Load critical features first
    await this.load_core();
    
    // Load enhanced features in background
    setTimeout(() => {
      this.load_enhanced_features();
    }, 1000);
  }
  
  async load_core() {
    // Essential functionality
    this.env = new SmartEnv(this);
    await this.env.load_base();
  }
  
  async load_enhanced_features() {
    // Nice-to-have features
    await this.env.load_ai_models();
    await this.env.load_advanced_search();
  }
}
```

## Security Practices

### 1. Input Sanitization
Always sanitize user input:
```javascript
function sanitize_for_display(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function render_user_content(container, content) {
  container.innerHTML = sanitize_for_display(content);
}
```

### 2. Process Isolation
Run external processes safely:
```javascript
class ClaudeCodeCLI {
  async execute(input) {
    const safe_input = this.validate_input(input);
    
    const process = spawn('claude', ['--safe-mode'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, CLAUDE_SAFE_MODE: '1' }
    });
    
    process.stdin.write(safe_input);
    process.stdin.end();
    
    return this.handle_output(process);
  }
}
```

### 3. Data Privacy
Keep sensitive data local:
```javascript
class PrivacyManager {
  constructor() {
    this.sensitive_patterns = [
      /api[_-]?key/i,
      /password/i,
      /secret/i,
      /token/i
    ];
  }
  
  should_exclude(text) {
    return this.sensitive_patterns.some(pattern => 
      pattern.test(text)
    );
  }
  
  filter_context(notes) {
    return notes.filter(note => 
      !this.should_exclude(note.content)
    );
  }
}
```

## Testing Strategies

### 1. Test Critical Paths
Focus on high-impact functionality:
```javascript
test('semantic search finds relevant notes', async t => {
  const env = await create_test_env();
  const query = 'machine learning';
  
  const results = await env.smart_sources.search(query);
  
  t.true(results.length > 0);
  t.true(results[0].score > 0.7);
});
```

### 2. Mock External Dependencies
Isolate units under test:
```javascript
test('adapter handles CLI timeout', async t => {
  const mock_cli = {
    execute: async () => {
      await sleep(10000);
      throw new Error('Timeout');
    }
  };
  
  const adapter = new ClaudeCodeCLIAdapter();
  adapter.cli = mock_cli;
  
  const error = await t.throwsAsync(
    adapter.generate_response('test')
  );
  t.is(error.message, 'Claude Code CLI timeout');
});
```

## Code Review Checklist

Before submitting code, ensure:

- [ ] Follows naming conventions (snake_case)
- [ ] Uses async/await consistently
- [ ] Includes error handling
- [ ] Has appropriate tests
- [ ] Performs well with large vaults
- [ ] Respects user privacy
- [ ] Works offline (if applicable)
- [ ] Includes necessary documentation
- [ ] Follows adapter pattern for platform code
- [ ] Uses events for component communication

---

*These best practices ensure Smart Connections remains maintainable, performant, and user-aligned.*
