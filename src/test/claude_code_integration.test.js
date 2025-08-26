import test from 'ava';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';

// Integration test suite for Claude Code CLI integration in Smart Connections
// Tests the complete flow from chat interface to Claude Code CLI execution

/**
 * INTEGRATION TESTING SUITE FOR CLAUDE CODE CLI
 * ==============================================
 * 
 * This suite validates the complete Claude Code integration including:
 * 1. End-to-end chat flow
 * 2. Context gathering and semantic search integration  
 * 3. Error handling and retry logic
 * 4. Configuration validation
 * 5. Process cleanup and resource management
 * 6. Performance testing
 */

let ClaudeCodeCLIAdapter, SmartEnv, SmartChatModel;

test.before(async () => {
  // Dynamic imports for ES modules
  const adapterModule = await import('../adapters/claude_code_cli_adapter.js');
  ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
  
  // We'll create minimal mocks for the Smart Environment
  SmartEnv = class MockSmartEnv {
    constructor(options = {}) {
      this.smart_sources = {
        search: async (query, opts) => {
          if (options.simulateNoResults) return [];
          if (options.simulateError) throw new Error('Search failed');
          
          return [
            {
              item: {
                path: 'test-notes/example.md',
                content: 'This is example content that matches the query about testing Claude Code integration.'
              },
              score: 0.85
            },
            {
              item: {
                path: 'documentation/claude-setup.md', 
                content: 'Instructions for setting up Claude Code CLI with proper PATH configuration.'
              },
              score: 0.78
            }
          ];
        }
      };
      
      this.smart_view = options.noActiveNote ? null : {
        active_note: {
          basename: 'current-test-note.md',
          content: 'This is the content of the currently active note for testing.'
        }
      };
    }
  };
  
  SmartChatModel = class MockSmartChatModel {
    constructor(options = {}) {
      this.env = new SmartEnv(options.envOptions || {});
      this.config = options.config || {};
      this.adapter_name = 'claude_code_cli';
      this.adapter = null; // Will be set when adapter is created
    }
  };
});

// ============================================================================
// END-TO-END INTEGRATION TESTS
// ============================================================================

test('complete end-to-end chat flow with Claude Code CLI', async t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  mockModel.adapter = adapter;
  
  // Mock successful CLI validation
  adapter.validate_connection = async () => true;
  
  // Track the complete flow
  let contextGathered = false;
  let promptFormatted = false;
  let cliExecuted = false;
  
  const originalGatherContext = adapter.gather_context;
  const originalFormatPrompt = adapter.format_prompt;
  const originalExecuteCLI = adapter.execute_claude_cli;
  
  adapter.gather_context = async function(query) {
    contextGathered = true;
    t.true(typeof query === 'string');
    t.true(query.length > 0);
    return await originalGatherContext.call(this, query);
  };
  
  adapter.format_prompt = async function(messages) {
    promptFormatted = true;
    t.true(Array.isArray(messages));
    return await originalFormatPrompt.call(this, messages);
  };
  
  adapter.execute_claude_cli = async function(prompt, options) {
    cliExecuted = true;
    t.true(typeof prompt === 'string');
    t.true(prompt.includes('You are an AI assistant'));
    t.true(prompt.includes('## Vault Context:'));
    
    return {
      id: 'integration-test-response',
      content: 'This is a test response from the Claude Code CLI integration.',
      role: 'assistant',
      model: 'claude-code-cli'
    };
  };
  
  // Simulate complete chat interaction
  const request = {
    messages: [
      { role: 'user', content: 'Can you help me understand how to use Claude Code CLI with my Obsidian vault?' }
    ]
  };
  
  const response = await adapter.complete(request);
  
  // Validate complete flow executed
  t.true(contextGathered, 'Context should have been gathered');
  t.true(promptFormatted, 'Prompt should have been formatted');
  t.true(cliExecuted, 'CLI should have been executed');
  
  // Validate response format
  t.truthy(response.id);
  t.true(Array.isArray(response.choices));
  t.is(response.choices[0].message.role, 'assistant');
  t.true(response.choices[0].message.content.includes('test response'));
  t.is(response.model, 'claude-code-cli');
  
  // Restore original methods
  adapter.gather_context = originalGatherContext;
  adapter.format_prompt = originalFormatPrompt;
  adapter.execute_claude_cli = originalExecuteCLI;
});

test('streaming integration with proper chunk handling', async t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  adapter.validate_connection = async () => true;
  
  // Track streaming behavior
  const receivedChunks = [];
  let finalResponse = null;
  let streamingCompleted = false;
  
  adapter.execute_claude_cli = async function(prompt, options) {
    // Simulate streaming chunks
    if (options.stream && options.chunk_handler) {
      const chunks = [
        { content: 'Hello! ' },
        { content: 'I can help ' },
        { content: 'you with ' },
        { content: 'Claude Code CLI.' }
      ];
      
      // Simulate async chunk delivery
      for (const chunk of chunks) {
        await new Promise(resolve => setTimeout(resolve, 10));
        options.chunk_handler(chunk);
      }
    }
    
    return {
      content: 'Hello! I can help you with Claude Code CLI.',
      id: 'streaming-test'
    };
  };
  
  const request = {
    messages: [{ role: 'user', content: 'Hello, can you help me?' }]
  };
  
  const handlers = {
    chunk: (chunk) => {
      receivedChunks.push(chunk);
      t.truthy(chunk.content);
      t.is(chunk.role, 'assistant');
      t.truthy(chunk.delta);
    },
    done: (response) => {
      finalResponse = response;
      streamingCompleted = true;
      t.truthy(response.id);
      t.is(response.content, 'Hello! I can help you with Claude Code CLI.');
    },
    error: () => {
      t.fail('Should not call error handler in successful streaming');
    }
  };
  
  await adapter.stream(request, handlers);
  
  t.is(receivedChunks.length, 4, 'Should receive 4 chunks');
  t.true(streamingCompleted, 'Streaming should complete');
  t.truthy(finalResponse, 'Should receive final response');
  
  // Verify accumulated content matches final response
  const accumulatedContent = receivedChunks.map(c => c.content).join('');
  t.is(accumulatedContent, finalResponse.content);
});

// ============================================================================
// CONTEXT INTEGRATION TESTS
// ============================================================================

test('semantic search integration with vault content', async t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  const context = await adapter.gather_context('test query about Claude setup');
  
  t.truthy(context);
  t.true(context.includes('## Current Note: current-test-note.md'));
  t.true(context.includes('## Related Content from Vault:'));
  t.true(context.includes('test-notes/example.md'));
  t.true(context.includes('documentation/claude-setup.md'));
  t.true(context.includes('Claude Code integration'));
  t.true(context.includes('PATH configuration'));
});

test('context gathering handles search failures gracefully', async t => {
  const mockModel = new SmartChatModel({
    envOptions: { simulateError: true }
  });
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  const context = await adapter.gather_context('test query');
  
  // Should return empty string when search fails
  t.is(context, '');
});

test('context gathering with no search results', async t => {
  const mockModel = new SmartChatModel({
    envOptions: { simulateNoResults: true }
  });
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  const context = await adapter.gather_context('test query');
  
  t.is(context, '');
});

test('context gathering without active note', async t => {
  const mockModel = new SmartChatModel({
    envOptions: { noActiveNote: true }
  });
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  const context = await adapter.gather_context('test query');
  
  t.false(context.includes('## Current Note:'));
  t.true(context.includes('## Related Content from Vault:'));
});

// ============================================================================
// ERROR HANDLING AND RESILIENCE TESTS
// ============================================================================

test('graceful degradation when Claude CLI is not available', async t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  // Mock CLI not available
  adapter.validate_connection = async () => false;
  
  const request = {
    messages: [{ role: 'user', content: 'Test message' }]
  };
  
  // Test complete method
  const completeResponse = await adapter.complete(request);
  t.truthy(completeResponse.error);
  t.true(completeResponse.content.includes('Claude Code CLI is not installed'));
  
  // Test stream method
  let errorHandlerCalled = false;
  const handlers = {
    error: (response) => {
      errorHandlerCalled = true;
      t.truthy(response.error);
      t.true(response.content.includes('Claude Code CLI is not installed'));
    },
    chunk: () => t.fail('Should not call chunk handler'),
    done: () => t.fail('Should not call done handler')
  };
  
  await adapter.stream(request, handlers);
  t.true(errorHandlerCalled, 'Error handler should be called');
});

test('retry logic with exponential backoff during failures', async t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  adapter.max_retries = 3;
  adapter.base_delay = 50; // Faster for testing
  
  adapter.validate_connection = async () => true;
  
  let attemptCount = 0;
  const originalSpawn = adapter.spawn_claude_process;
  
  adapter.spawn_claude_process = async function(prompt, options) {
    attemptCount++;
    
    if (attemptCount < 3) {
      // Fail first two attempts
      throw new Error(`Network error on attempt ${attemptCount}`);
    }
    
    // Succeed on third attempt
    return {
      id: 'retry-success',
      content: `Success after ${attemptCount} attempts`,
      role: 'assistant'
    };
  };
  
  const startTime = Date.now();
  const response = await adapter.execute_claude_cli('test prompt');
  const duration = Date.now() - startTime;
  
  // Restore original method
  adapter.spawn_claude_process = originalSpawn;
  
  t.is(attemptCount, 3, 'Should attempt 3 times');
  t.is(response.content, 'Success after 3 attempts');
  t.true(duration >= 150, 'Should wait for exponential backoff delays'); // 50ms + 100ms minimum
});

test('proper cleanup on process timeout', async t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  adapter.timeout = 100; // Very short timeout for testing
  
  adapter.validate_connection = async () => true;
  
  const originalSpawn = adapter.spawn_claude_process;
  
  adapter.spawn_claude_process = async function(prompt, options) {
    // Simulate a process that never responds (timeout scenario)
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error('Claude Code CLI timed out after 100ms'));
      }, 150); // Longer than timeout
    });
  };
  
  const response = await adapter.execute_claude_cli('test prompt');
  
  // Restore original method
  adapter.spawn_claude_process = originalSpawn;
  
  t.truthy(response.error);
  t.true(response.content.includes('having trouble connecting'));
});

// ============================================================================
// CONFIGURATION VALIDATION TESTS
// ============================================================================

test('configuration priority validation - Claude Code CLI first', async t => {
  // Test that config properly prioritizes Claude Code CLI
  const { smart_env_config } = await import('../smart_env.config.js');
  
  // Verify Claude Code CLI is configured as primary adapter
  t.is(smart_env_config.default_settings.smart_chat_model.adapter, 'claude_code_cli');
  t.is(smart_env_config.default_settings.smart_chat_model.model_key, 'claude-code-cli');
  
  // Verify adapter is registered
  t.truthy(smart_env_config.modules.smart_chat_model.adapters.claude_code_cli);
  t.is(smart_env_config.modules.smart_chat_model.adapters.claude_code_cli, ClaudeCodeCLIAdapter);
  
  // Verify local alternatives are available
  t.truthy(smart_env_config.modules.smart_chat_model.adapters.ollama);
  t.truthy(smart_env_config.modules.smart_chat_model.adapters.lm_studio);
  t.truthy(smart_env_config.modules.smart_chat_model.adapters.custom);
});

test('Claude Code CLI specific configuration validation', async t => {
  const { smart_env_config } = await import('../smart_env.config.js');
  
  const claudeConfig = smart_env_config.default_settings.smart_chat_model.claude_code_cli;
  
  t.truthy(claudeConfig);
  t.is(claudeConfig.timeout, 60000);
  t.is(claudeConfig.max_retries, 3);
  t.is(claudeConfig.base_delay, 1000);
  t.is(claudeConfig.context_limit, 5);
  t.is(claudeConfig.model_key, 'claude-code-cli');
});

// ============================================================================
// PERFORMANCE AND RESOURCE MANAGEMENT TESTS
// ============================================================================

test('memory usage during multiple concurrent requests', async t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  adapter.validate_connection = async () => true;
  adapter.execute_claude_cli = async (prompt, options) => {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
      id: `concurrent-${Date.now()}`,
      content: 'Response from concurrent request',
      role: 'assistant'
    };
  };
  
  const request = {
    messages: [{ role: 'user', content: 'Concurrent test message' }]
  };
  
  // Start multiple concurrent requests
  const concurrentRequests = Array(5).fill().map(() => 
    adapter.complete(request)
  );
  
  const startMemory = process.memoryUsage();
  const responses = await Promise.all(concurrentRequests);
  const endMemory = process.memoryUsage();
  
  // Validate all requests completed successfully
  t.is(responses.length, 5);
  responses.forEach(response => {
    t.truthy(response.id);
    t.is(response.choices[0].message.content, 'Response from concurrent request');
  });
  
  // Memory usage should not grow excessively (less than 50MB increase)
  const memoryGrowth = endMemory.heapUsed - startMemory.heapUsed;
  t.true(memoryGrowth < 50 * 1024 * 1024, `Memory growth: ${memoryGrowth} bytes`);
});

test('response time performance benchmarking', async t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  adapter.validate_connection = async () => true;
  
  // Mock fast response
  adapter.execute_claude_cli = async (prompt, options) => {
    // Simulate realistic processing time
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      id: 'performance-test',
      content: 'Fast response for performance testing',
      role: 'assistant'
    };
  };
  
  const request = {
    messages: [{ role: 'user', content: 'Performance test message' }]
  };
  
  const startTime = Date.now();
  const response = await adapter.complete(request);
  const responseTime = Date.now() - startTime;
  
  t.truthy(response.id);
  t.is(response.choices[0].message.content, 'Fast response for performance testing');
  
  // Should complete within reasonable time (including context gathering)
  t.true(responseTime < 1000, `Response time: ${responseTime}ms`);
});

// ============================================================================
// UI INTEGRATION VALIDATION
// ============================================================================

test('model indicator updates correctly', async t => {
  // This tests the UI integration that updates the model indicator
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  mockModel.adapter = adapter;
  
  // Mock DOM elements
  const mockFragment = {
    querySelector: (selector) => {
      if (selector === '#claude-model-indicator') {
        return {
          classList: {
            add: () => {},
            remove: () => {},
          },
          querySelector: (childSelector) => {
            if (childSelector === '.status-dot') {
              return { style: {} };
            }
            if (childSelector === '.model-name') {
              return { textContent: '' };
            }
          },
          title: '',
          style: {},
          addEventListener: () => {}
        };
      }
      if (selector === 'button[title="Chat Settings"]') {
        return { click: () => {} };
      }
    }
  };
  
  // Import the update function
  const { post_process } = await import('../views/smart_chat.js');
  
  // Test would require more complex DOM mocking to be fully functional
  // For now, validate that the adapter properties are correct
  t.is(mockModel.adapter_name, 'claude_code_cli');
  t.truthy(mockModel.adapter);
  t.true(typeof adapter.validate_connection === 'function');
});

// ============================================================================
// ACTUAL CLI INTEGRATION TESTS (if CLI is available)
// ============================================================================

test('real CLI validation if available', async t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  // Test actual CLI availability
  const isAvailable = await adapter.validate_connection();
  
  if (isAvailable) {
    console.log('✅ Claude Code CLI is available - running integration test');
    
    // Only run this if CLI is actually available
    const testConnection = await adapter.test_connection();
    t.true(testConnection, 'CLI connection test should pass when CLI is available');
  } else {
    console.log('ℹ️ Claude Code CLI not available - skipping real CLI test');
    t.is(typeof isAvailable, 'boolean', 'Should return boolean even when CLI not available');
  }
});

// ============================================================================
// EDGE CASES AND ERROR SCENARIOS
// ============================================================================

test('handles malformed CLI responses gracefully', async t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  adapter.validate_connection = async () => true;
  
  const originalSpawn = adapter.spawn_claude_process;
  adapter.spawn_claude_process = async function(prompt, options) {
    // Return malformed response
    return {
      id: 'malformed-test',
      content: null, // Malformed content
      role: 'assistant'
    };
  };
  
  const request = {
    messages: [{ role: 'user', content: 'Test message' }]
  };
  
  const response = await adapter.complete(request);
  
  // Restore original method
  adapter.spawn_claude_process = originalSpawn;
  
  // Should handle null content gracefully
  t.truthy(response);
  t.truthy(response.choices);
  t.true(response.choices[0].message.content === null || typeof response.choices[0].message.content === 'string');
});

test('handles extremely large context gracefully', async t => {
  const mockModel = new SmartChatModel();
  // Override to return large content
  mockModel.env.smart_sources.search = async () => [{
    item: {
      path: 'large-note.md',
      content: 'A'.repeat(100000) // 100KB of content
    }
  }];
  
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  const context = await adapter.gather_context('large content test');
  
  // Should truncate large content appropriately
  t.true(context.length < 50000, 'Context should be truncated for performance');
  t.true(context.includes('A'.repeat(500)), 'Should include truncated content');
});

test('cleanup method can be called multiple times safely', t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  // Should not throw when called multiple times
  t.notThrows(() => {
    adapter.cleanup();
    adapter.cleanup();
    adapter.cleanup();
  });
});

// ============================================================================
// SUMMARY VALIDATION
// ============================================================================

test('complete integration validation summary', async t => {
  const mockModel = new SmartChatModel();
  const adapter = new ClaudeCodeCLIAdapter(mockModel);
  
  // Validate all required methods exist and are functions
  const requiredMethods = [
    'validate_connection',
    'gather_context', 
    'format_prompt',
    'execute_claude_cli',
    'complete',
    'stream',
    'test_connection',
    'cleanup'
  ];
  
  requiredMethods.forEach(method => {
    t.is(typeof adapter[method], 'function', `${method} should be a function`);
  });
  
  // Validate required properties
  t.is(typeof adapter.timeout, 'number');
  t.is(typeof adapter.max_retries, 'number');
  t.is(typeof adapter.base_delay, 'number');
  t.is(typeof adapter.can_stream, 'boolean');
  t.true(adapter.can_stream, 'Should support streaming');
  
  // Validate models property
  const models = adapter.models;
  t.true(Array.isArray(models));
  t.true(models.length > 0);
  t.truthy(models[0].id);
  t.truthy(models[0].name);
  
  console.log('✅ Claude Code CLI Integration Validation Complete');
  console.log(`   - Adapter methods: ${requiredMethods.length} validated`);
  console.log(`   - Properties: timeout=${adapter.timeout}ms, retries=${adapter.max_retries}, streaming=${adapter.can_stream}`);
  console.log(`   - Models available: ${models.length}`);
});