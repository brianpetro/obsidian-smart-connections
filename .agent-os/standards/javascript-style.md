# JavaScript Coding Standards

## Language Version & Module System

### ES2022 with ES Modules
```javascript
// Always use ES module imports
import { ClassName } from './module.js';
import DefaultExport from './default.js';

// Always include .js extension in imports
import { utility } from './utils/helper.js';  // ✓ Correct
import { utility } from './utils/helper';     // ✗ Wrong
```

### File Extensions
- Always use `.js` extension for JavaScript files
- Test files use `.test.js` suffix, co-located with source

## Naming Conventions

### Files and Directories
```javascript
// Files: snake_case
smart_env.config.js
connections_view.js
claude_code_cli_adapter.js

// Directories: lowercase or snake_case
src/adapters/
src/components/
smart-chat-v0/  // Legacy, uses hyphen
```

### Classes and Functions
```javascript
// Classes: PascalCase
class SmartConnectionsPlugin extends Plugin { }
class ClaudeCodeCLIAdapter { }

// Functions: snake_case
async function generate_embedding(text) { }
function render_component(container, opts) { }

// Methods: snake_case
class MyClass {
  async initialize_environment() { }
  get collection_data() { }
}
```

### Variables and Properties
```javascript
// Variables: snake_case
const search_results = await find_similar(query);
const embed_model = this.env.smart_embed_model;

// Configuration objects: snake_case keys
const config = {
  env_path: '',
  env_data_dir: '.smart-env',
  process_embed_queue: true
};

// Component options: snake_case
render(container, {
  show_full_path: true,
  results_limit: 20
});
```

## Async/Await Patterns

### Always Use Async/Await
```javascript
// Correct: async/await
async function fetch_data() {
  try {
    const data = await load_from_file();
    return process_data(data);
  } catch (error) {
    console.error('Failed to fetch data:', error);
    return null;
  }
}

// Avoid: raw promises
function fetch_data() {
  return load_from_file()
    .then(data => process_data(data))
    .catch(error => {
      console.error('Failed:', error);
      return null;
    });
}
```

### Error Handling
```javascript
// Use try-catch for async operations
async function safe_operation() {
  try {
    const result = await risky_operation();
    return { success: true, data: result };
  } catch (error) {
    console.error('[SmartConnections]', error);
    return { success: false, error: error.message };
  }
}

// Guard clauses for early returns
async function process_item(item) {
  if (!item) return null;
  if (!item.valid) return { error: 'Invalid item' };
  
  return await transform_item(item);
}
```

## Component Patterns

### Render Functions
```javascript
// Standard component export pattern
export function render(container, opts = {}) {
  const { env, data, show_full_path = false } = opts;
  
  // Clear existing content
  container.innerHTML = '';
  
  // Build component
  const component = container.createDiv('sc-component');
  
  // Add event listeners
  component.addEventListener('click', handle_click);
  
  // Return cleanup function if needed
  return () => {
    component.removeEventListener('click', handle_click);
  };
}
```

### Component Registration
```javascript
// In config file
components: {
  connections: connections_component,
  lookup: lookup_component,
  results: results_component
}

// Usage
env.render_component(container, 'connections', { data });
```

## Class Patterns

### Adapter Pattern
```javascript
// Base adapter class extension
export class ClaudeCodeCLIAdapter extends SmartChatModelAdapter {
  constructor(env) {
    super(env);
    this.adapter_id = 'claude_code_cli';
  }
  
  async stream_chat_completion(messages, opts = {}) {
    // Implementation
  }
  
  async count_tokens(messages) {
    // Implementation
  }
}
```

### Plugin Pattern
```javascript
// Obsidian plugin structure
export default class SmartConnectionsPlugin extends Plugin {
  async onload() {
    console.log('Loading Smart Connections v' + this.manifest.version);
    // Initial setup
  }
  
  async initialize() {
    // Main initialization after onload
    this.env = await this.load_env();
  }
  
  onunload() {
    // Cleanup
    this.env?.unload();
  }
}
```

## Configuration Management

### Hierarchical Config Merging
```javascript
// Base configuration
export const smart_env_config = {
  collections: {
    smart_sources: {
      class: SmartSources,
      data_adapter: AjsonAdapter
    }
  },
  modules: {
    smart_chat_model: {
      adapters: {
        claude_code_cli: ClaudeCodeCLIAdapter
      }
    }
  }
};

// Merge configurations
const final_config = merge_env_config(
  base_config,
  plugin_config,
  user_settings
);
```

## Event Handling

### Event Naming
```javascript
// Event names: namespace:action
'smart-env:loaded'
'smart-sources:changed'
'smart-chat:message'
'smart-connections:refresh'
```

### Event Listeners
```javascript
// Register event listeners
this.registerEvent(
  this.app.vault.on('modify', this.handle_file_change.bind(this))
);

// Custom event handling
env.on('smart-env:loaded', () => {
  this.refresh_views();
});
```

## Testing Patterns

### Test File Organization
```javascript
// Co-located test files
src/utils/banner.js
src/utils/banner.test.js

// Test structure with AVA
import test from 'ava';

test('should generate banner correctly', async t => {
  const result = await generate_banner(input);
  t.is(result, expected);
});
```

## Comments and Documentation

### When to Comment
```javascript
// Comment complex logic only
async function calculate_similarity(vec1, vec2) {
  // Cosine similarity: dot(a,b)/(||a||*||b||)
  const dot = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
  const mag1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const mag2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));
  return dot / (mag1 * mag2);
}

// Document non-obvious decisions
// Using AJSON for better performance with large collections
const adapter = new AjsonMultiFileCollectionDataAdapter();
```

### JSDoc for Public APIs
```javascript
/**
 * Generate embeddings for text content
 * @param {string} text - The text to embed
 * @param {Object} opts - Options
 * @returns {Promise<number[]>} The embedding vector
 */
async function generate_embedding(text, opts = {}) {
  // Implementation
}
```

## Performance Patterns

### Debouncing
```javascript
// Debounce expensive operations
const debounced_refresh = debounce(
  () => this.refresh_connections(),
  500
);
```

### Lazy Loading
```javascript
// Load on demand
get smart_chat_model() {
  if (!this._smart_chat_model) {
    this._smart_chat_model = new SmartChatModel(this);
  }
  return this._smart_chat_model;
}
```

### Batch Operations
```javascript
// Process in batches
async function process_files(files) {
  const batch_size = 10;
  for (let i = 0; i < files.length; i += batch_size) {
    const batch = files.slice(i, i + batch_size);
    await Promise.all(batch.map(process_file));
  }
}
```

## Do's and Don'ts

### Do's
- ✓ Use snake_case for functions and variables
- ✓ Use async/await for all asynchronous code
- ✓ Include .js extension in imports
- ✓ Use guard clauses for early returns
- ✓ Co-locate test files with source
- ✓ Use const by default, let when needed
- ✓ Export functions/classes explicitly

### Don'ts
- ✗ Don't use var
- ✗ Don't use callback-style async
- ✗ Don't use eval() or Function()
- ✗ Don't modify prototypes
- ✗ Don't use global variables
- ✗ Don't ignore error handling
- ✗ Don't use synchronous file operations

---

*These standards are derived from the actual Smart Connections codebase and should be followed for all new code.*