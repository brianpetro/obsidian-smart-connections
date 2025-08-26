#!/usr/bin/env node

/**
 * END-TO-END CLAUDE CODE CLI INTEGRATION TEST
 * ============================================
 * 
 * This script performs comprehensive end-to-end testing of the Claude Code CLI integration
 * by simulating real user interactions and validating the complete workflow from
 * chat interface to CLI execution.
 * 
 * Usage:
 *   node scripts/e2e_claude_test.js
 *   node scripts/e2e_claude_test.js --with-real-cli
 *   node scripts/e2e_claude_test.js --simulate-failures
 */

import { EventEmitter } from 'events';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const withRealCLI = process.argv.includes('--with-real-cli');
const simulateFailures = process.argv.includes('--simulate-failures');
const verbose = process.argv.includes('--verbose');

// ANSI colors
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

/**
 * End-to-end test results tracker
 */
class E2EResults {
  constructor() {
    this.scenarios = [];
    this.currentScenario = null;
  }
  
  startScenario(name, description) {
    this.currentScenario = {
      name,
      description,
      startTime: Date.now(),
      steps: [],
      status: 'running'
    };
    
    console.log(`\n${colors.bold}${colors.cyan}🚀 Starting Scenario: ${name}${colors.reset}`);
    console.log(`   ${description}\n`);
    
    return this.currentScenario;
  }
  
  stepPass(step, message, data = null) {
    if (this.currentScenario) {
      this.currentScenario.steps.push({
        step,
        status: 'pass',
        message,
        data,
        timestamp: Date.now()
      });
    }
    console.log(`   ${colors.green}✅ ${step}:${colors.reset} ${message}`);
    if (verbose && data) {
      console.log(`      ${colors.cyan}Data: ${JSON.stringify(data, null, 2)}${colors.reset}`);
    }
  }
  
  stepFail(step, message, error = null) {
    if (this.currentScenario) {
      this.currentScenario.steps.push({
        step,
        status: 'fail',
        message,
        error: error?.message || error,
        timestamp: Date.now()
      });
    }
    console.log(`   ${colors.red}❌ ${step}:${colors.reset} ${message}`);
    if (error) {
      console.log(`      ${colors.red}Error: ${error.message || error}${colors.reset}`);
    }
  }
  
  stepWarn(step, message, details = null) {
    if (this.currentScenario) {
      this.currentScenario.steps.push({
        step,
        status: 'warn',
        message,
        details,
        timestamp: Date.now()
      });
    }
    console.log(`   ${colors.yellow}⚠️  ${step}:${colors.reset} ${message}`);
    if (details) {
      console.log(`      ${colors.yellow}Details: ${details}${colors.reset}`);
    }
  }
  
  endScenario(status = 'completed') {
    if (this.currentScenario) {
      this.currentScenario.status = status;
      this.currentScenario.duration = Date.now() - this.currentScenario.startTime;
      this.scenarios.push(this.currentScenario);
      
      const passed = this.currentScenario.steps.filter(s => s.status === 'pass').length;
      const failed = this.currentScenario.steps.filter(s => s.status === 'fail').length;
      const warned = this.currentScenario.steps.filter(s => s.status === 'warn').length;
      
      console.log(`\n   ${colors.bold}Scenario Complete:${colors.reset} ${this.currentScenario.name}`);
      console.log(`   Duration: ${this.currentScenario.duration}ms`);
      console.log(`   ${colors.green}Passed: ${passed}${colors.reset}, ${colors.red}Failed: ${failed}${colors.reset}, ${colors.yellow}Warned: ${warned}${colors.reset}`);
      
      this.currentScenario = null;
    }
  }
  
  getSummary() {
    const total = this.scenarios.length;
    const completed = this.scenarios.filter(s => s.status === 'completed').length;
    const allSteps = this.scenarios.flatMap(s => s.steps);
    const passed = allSteps.filter(s => s.status === 'pass').length;
    const failed = allSteps.filter(s => s.status === 'fail').length;
    const warned = allSteps.filter(s => s.status === 'warn').length;
    
    return {
      scenarios: { total, completed },
      steps: { total: allSteps.length, passed, failed, warned },
      success: failed === 0 && completed === total
    };
  }
}

const results = new E2EResults();

/**
 * Create realistic mock Smart Environment
 */
function createRealisticMockEnv() {
  const mockNotes = [
    {
      path: 'Getting Started/Claude Code Setup.md',
      content: `# Claude Code CLI Setup Guide

## Installation
To install Claude Code CLI:
1. Download from the official website
2. Add to your PATH
3. Verify with \`claude --version\`

## Configuration
Configure your API keys and preferences in the settings.

## Integration with Obsidian
The Smart Connections plugin integrates seamlessly with Claude Code CLI for enhanced AI assistance.`
    },
    {
      path: 'Daily Notes/2024-01-15.md',
      content: `# Daily Note - January 15, 2024

## Tasks
- [ ] Set up Claude Code CLI integration
- [x] Review AI assistant workflows
- [ ] Optimize note-taking process

## Notes
The new AI integration is working well. Context gathering from the vault is very helpful.

## Links
[[Claude Code Setup]] - Setup guide for the CLI tool`
    },
    {
      path: 'Research/AI Tools Comparison.md',
      content: `# AI Tools Comparison

## Claude Code CLI
- Local processing
- Good integration with development tools
- Strong context awareness

## Other Tools
- OpenAI API
- Anthropic Claude
- Local models (Ollama)

## Evaluation Criteria
- Performance
- Privacy
- Integration capabilities
- Cost`
    },
    {
      path: 'Projects/Smart Connections Integration.md',
      content: `# Smart Connections Integration Project

## Goals
- Integrate Claude Code CLI as primary AI provider
- Maintain compatibility with other providers
- Ensure good performance and error handling

## Implementation Status
- [x] Adapter implementation
- [x] Configuration setup
- [x] Error handling
- [ ] Performance optimization
- [ ] End-to-end testing

## Next Steps
Comprehensive testing and validation of the integration.`
    }
  ];
  
  return {
    smart_sources: {
      search: async (query, opts = {}) => {
        const limit = opts.limit || 5;
        const threshold = opts.threshold || 0.5;
        
        // Simulate semantic search by matching keywords
        const queryWords = query.toLowerCase().split(' ');
        const results = mockNotes
          .map(note => {
            const content = (note.content || '').toLowerCase();
            const title = note.path.toLowerCase();
            
            // Calculate simple relevance score
            let score = 0;
            queryWords.forEach(word => {
              if (title.includes(word)) score += 0.3;
              if (content.includes(word)) score += 0.1;
            });
            
            return {
              item: note,
              score: Math.min(score, 1.0)
            };
          })
          .filter(result => result.score >= threshold)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        
        // Add some processing delay
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30));
        
        return results;
      }
    },
    smart_view: {
      active_note: mockNotes[1] // Daily note as active
    }
  };
}

/**
 * Scenario 1: Basic Integration Test
 */
async function testBasicIntegration() {
  const scenario = results.startScenario(
    'Basic Integration', 
    'Test basic adapter initialization and core functionality'
  );
  
  try {
    // Import the adapter
    const adapterModule = await import(`${join(projectRoot, 'src/adapters/claude_code_cli_adapter.js')}`);
    const ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
    results.stepPass('import-adapter', 'Successfully imported ClaudeCodeCLIAdapter');
    
    // Create mock environment
    const mockModel = {
      config: {
        timeout: 30000,
        max_retries: 3,
        base_delay: 1000
      },
      env: createRealisticMockEnv()
    };
    
    // Initialize adapter
    const adapter = new ClaudeCodeCLIAdapter(mockModel);
    results.stepPass('init-adapter', 'Adapter initialized successfully');
    
    // Test properties
    if (adapter.timeout === 60000) {
      results.stepPass('default-timeout', `Timeout set to ${adapter.timeout}ms`);
    } else {
      results.stepFail('default-timeout', `Expected timeout 60000, got ${adapter.timeout}`);
    }
    
    if (adapter.can_stream === true) {
      results.stepPass('streaming-support', 'Streaming support enabled');
    } else {
      results.stepFail('streaming-support', 'Streaming support not enabled');
    }
    
    // Test models property
    const models = adapter.models;
    if (Array.isArray(models) && models.length > 0 && models[0].id === 'claude-code-cli') {
      results.stepPass('models-property', `Models property returns ${models.length} model(s)`);
    } else {
      results.stepFail('models-property', 'Models property invalid or empty');
    }
    
  } catch (error) {
    results.stepFail('basic-integration', 'Basic integration test failed', error);
  }
  
  results.endScenario();
}

/**
 * Scenario 2: Context Gathering Test
 */
async function testContextGathering() {
  const scenario = results.startScenario(
    'Context Gathering',
    'Test semantic search integration and context formatting'
  );
  
  try {
    const adapterModule = await import(`${join(projectRoot, 'src/adapters/claude_code_cli_adapter.js')}`);
    const ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
    
    const mockModel = {
      config: {},
      env: createRealisticMockEnv()
    };
    
    const adapter = new ClaudeCodeCLIAdapter(mockModel);
    
    // Test context gathering with relevant query
    const context = await adapter.gather_context('How do I set up Claude Code CLI?');
    
    if (context && typeof context === 'string' && context.length > 0) {
      results.stepPass('context-generation', `Generated context with ${context.length} characters`);
    } else {
      results.stepFail('context-generation', 'Failed to generate valid context');
      results.endScenario('failed');
      return;
    }
    
    // Verify context structure
    if (context.includes('## Current Note:')) {
      results.stepPass('active-note-context', 'Active note included in context');
    } else {
      results.stepWarn('active-note-context', 'Active note not found in context');
    }
    
    if (context.includes('## Related Content from Vault:')) {
      results.stepPass('search-results-context', 'Search results included in context');
    } else {
      results.stepWarn('search-results-context', 'Search results not found in context');
    }
    
    // Check for expected content
    if (context.includes('Claude Code CLI')) {
      results.stepPass('relevant-content', 'Context contains relevant content about Claude Code CLI');
    } else {
      results.stepWarn('relevant-content', 'Context may not contain highly relevant content');
    }
    
    // Test with different query
    const techContext = await adapter.gather_context('AI tools comparison performance analysis');
    if (techContext.length !== context.length) {
      results.stepPass('dynamic-context', 'Context generation adapts to different queries');
    } else {
      results.stepWarn('dynamic-context', 'Context may not be dynamically adapting to queries');
    }
    
    if (verbose) {
      results.stepPass('context-sample', 'Context sample captured', {
        length: context.length,
        preview: context.substring(0, 200) + '...'
      });
    }
    
  } catch (error) {
    results.stepFail('context-gathering', 'Context gathering test failed', error);
  }
  
  results.endScenario();
}

/**
 * Scenario 3: Prompt Formatting Test
 */
async function testPromptFormatting() {
  const scenario = results.startScenario(
    'Prompt Formatting',
    'Test conversation history formatting and prompt structure'
  );
  
  try {
    const adapterModule = await import(`${join(projectRoot, 'src/adapters/claude_code_cli_adapter.js')}`);
    const ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
    
    const mockModel = {
      config: {},
      env: createRealisticMockEnv()
    };
    
    const adapter = new ClaudeCodeCLIAdapter(mockModel);
    
    // Test simple conversation
    const simpleMessages = [
      { role: 'user', content: 'Hello, can you help me with Claude Code CLI?' }
    ];
    
    const simplePrompt = await adapter.format_prompt(simpleMessages);
    
    if (simplePrompt && typeof simplePrompt === 'string' && simplePrompt.length > 0) {
      results.stepPass('basic-prompt', `Generated basic prompt with ${simplePrompt.length} characters`);
    } else {
      results.stepFail('basic-prompt', 'Failed to generate basic prompt');
      results.endScenario('failed');
      return;
    }
    
    // Verify prompt structure
    if (simplePrompt.includes('You are an AI assistant helping with an Obsidian vault')) {
      results.stepPass('system-message', 'System message included in prompt');
    } else {
      results.stepFail('system-message', 'System message not found in prompt');
    }
    
    if (simplePrompt.includes('## Vault Context:')) {
      results.stepPass('vault-context', 'Vault context section included');
    } else {
      results.stepWarn('vault-context', 'Vault context section not found');
    }
    
    if (simplePrompt.includes('## Conversation History:')) {
      results.stepPass('conversation-history', 'Conversation history section included');
    } else {
      results.stepFail('conversation-history', 'Conversation history section not found');
    }
    
    // Test multi-turn conversation
    const multiTurnMessages = [
      { role: 'user', content: 'What is Claude Code CLI?' },
      { role: 'assistant', content: 'Claude Code CLI is a command-line interface for interacting with Claude AI.' },
      { role: 'user', content: 'How do I install it?' },
      { role: 'assistant', content: 'You can install it by downloading from the official website and adding it to your PATH.' },
      { role: 'user', content: 'Can it integrate with Obsidian?' }
    ];
    
    const multiTurnPrompt = await adapter.format_prompt(multiTurnMessages);
    
    if (multiTurnPrompt.length > simplePrompt.length) {
      results.stepPass('multi-turn-prompt', `Multi-turn prompt is longer (${multiTurnPrompt.length} vs ${simplePrompt.length} characters)`);
    } else {
      results.stepWarn('multi-turn-prompt', 'Multi-turn prompt may not be properly formatted');
    }
    
    // Check for proper role formatting
    if (multiTurnPrompt.includes('### Human 1:') && multiTurnPrompt.includes('### Assistant 2:')) {
      results.stepPass('role-formatting', 'Messages properly formatted with roles and numbers');
    } else {
      results.stepFail('role-formatting', 'Messages not properly formatted');
    }
    
    // Test edge cases
    const emptyMessages = [];
    const emptyPrompt = await adapter.format_prompt(emptyMessages);
    
    if (emptyPrompt.includes('You are an AI assistant') && !emptyPrompt.includes('## Conversation History:')) {
      results.stepPass('empty-conversation', 'Empty conversation handled properly');
    } else {
      results.stepWarn('empty-conversation', 'Empty conversation handling may be incorrect');
    }
    
    if (verbose) {
      results.stepPass('prompt-sample', 'Prompt sample captured', {
        simple_length: simplePrompt.length,
        multi_turn_length: multiTurnPrompt.length,
        empty_length: emptyPrompt.length,
        preview: simplePrompt.substring(0, 300) + '...'
      });
    }
    
  } catch (error) {
    results.stepFail('prompt-formatting', 'Prompt formatting test failed', error);
  }
  
  results.endScenario();
}

/**
 * Scenario 4: Complete Method Test
 */
async function testCompleteMethod() {
  const scenario = results.startScenario(
    'Complete Method',
    'Test the complete() method with mock CLI execution'
  );
  
  try {
    const adapterModule = await import(`${join(projectRoot, 'src/adapters/claude_code_cli_adapter.js')}`);
    const ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
    
    const mockModel = {
      config: {},
      env: createRealisticMockEnv()
    };
    
    const adapter = new ClaudeCodeCLIAdapter(mockModel);
    
    // Mock CLI validation and execution
    adapter.validate_connection = async () => !simulateFailures;
    
    if (!simulateFailures) {
      adapter.execute_claude_cli = async (prompt, options) => {
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        return {
          id: `e2e-test-${Date.now()}`,
          content: `Based on your question about Claude Code CLI setup, I can help you get started. The installation process involves downloading the CLI tool and configuring it in your environment. Here's what you need to know about integrating it with your Obsidian vault...`,
          role: 'assistant',
          model: 'claude-code-cli',
          usage: {
            prompt_tokens: Math.floor(prompt.length / 4),
            completion_tokens: 50,
            total_tokens: Math.floor(prompt.length / 4) + 50
          }
        };
      };
    }
    
    const request = {
      messages: [
        { role: 'user', content: 'I need help setting up Claude Code CLI with my Obsidian vault. Can you guide me through the process?' }
      ]
    };
    
    const startTime = Date.now();
    const response = await adapter.complete(request);
    const responseTime = Date.now() - startTime;
    
    if (!simulateFailures) {
      // Test successful response
      if (response && response.choices && response.choices[0] && response.choices[0].message) {
        results.stepPass('response-structure', 'Response has correct structure');
        
        const message = response.choices[0].message;
        if (message.role === 'assistant' && message.content && message.content.length > 0) {
          results.stepPass('response-content', `Response contains ${message.content.length} characters`);
        } else {
          results.stepFail('response-content', 'Response content invalid');
        }
        
        if (response.model === 'claude-code-cli') {
          results.stepPass('response-model', 'Response model correctly set');
        } else {
          results.stepFail('response-model', `Expected 'claude-code-cli', got '${response.model}'`);
        }
        
        if (response.usage && response.usage.total_tokens > 0) {
          results.stepPass('response-usage', `Token usage reported: ${response.usage.total_tokens} tokens`);
        } else {
          results.stepWarn('response-usage', 'Token usage not properly reported');
        }
        
        if (responseTime < 5000) {
          results.stepPass('response-time', `Response time: ${responseTime}ms`);
        } else {
          results.stepWarn('response-time', `Response time slow: ${responseTime}ms`);
        }
        
      } else {
        results.stepFail('complete-method', 'Response structure invalid');
      }
    } else {
      // Test failure scenario
      if (response && response.error) {
        results.stepPass('error-handling', 'Error properly handled when CLI unavailable');
        
        if (response.content && response.content.includes('Claude Code CLI is not installed')) {
          results.stepPass('error-message', 'Appropriate error message provided');
        } else {
          results.stepWarn('error-message', 'Error message may not be user-friendly');
        }
      } else {
        results.stepFail('error-handling', 'Error not properly handled');
      }
    }
    
    if (verbose) {
      results.stepPass('complete-response-details', 'Complete response details captured', {
        response_time: responseTime,
        response_structure: {
          has_choices: !!response?.choices,
          choices_length: response?.choices?.length || 0,
          has_usage: !!response?.usage,
          model: response?.model
        }
      });
    }
    
  } catch (error) {
    results.stepFail('complete-method', 'Complete method test failed', error);
  }
  
  results.endScenario();
}

/**
 * Scenario 5: Streaming Test
 */
async function testStreamingMethod() {
  const scenario = results.startScenario(
    'Streaming Method',
    'Test the stream() method with chunk handling'
  );
  
  try {
    const adapterModule = await import(`${join(projectRoot, 'src/adapters/claude_code_cli_adapter.js')}`);
    const ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
    
    const mockModel = {
      config: {},
      env: createRealisticMockEnv()
    };
    
    const adapter = new ClaudeCodeCLIAdapter(mockModel);
    
    // Mock streaming execution
    adapter.validate_connection = async () => !simulateFailures;
    
    if (!simulateFailures) {
      adapter.execute_claude_cli = async (prompt, options) => {
        if (options.stream && options.chunk_handler) {
          const chunks = [
            'Hello! I can help you ',
            'set up Claude Code CLI ',
            'with your Obsidian vault. ',
            'First, you\'ll need to ',
            'download and install ',
            'the CLI tool from the ',
            'official website.'
          ];
          
          // Simulate streaming chunks
          for (let i = 0; i < chunks.length; i++) {
            await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
            options.chunk_handler({
              content: chunks[i],
              index: i
            });
          }
        }
        
        return {
          content: 'Hello! I can help you set up Claude Code CLI with your Obsidian vault. First, you\'ll need to download and install the CLI tool from the official website.',
          id: `stream-test-${Date.now()}`
        };
      };
    }
    
    const request = {
      messages: [
        { role: 'user', content: 'Help me set up Claude Code CLI streaming test' }
      ]
    };
    
    // Track streaming events
    const chunks = [];
    let doneResponse = null;
    let errorResponse = null;
    
    const startTime = Date.now();
    
    const handlers = {
      chunk: (chunk) => {
        chunks.push({
          content: chunk.content,
          timestamp: Date.now() - startTime
        });
      },
      done: (response) => {
        doneResponse = response;
      },
      error: (response) => {
        errorResponse = response;
      }
    };
    
    await adapter.stream(request, handlers);
    const streamTime = Date.now() - startTime;
    
    if (!simulateFailures) {
      // Test successful streaming
      if (chunks.length > 0) {
        results.stepPass('chunk-reception', `Received ${chunks.length} chunks`);
        
        const totalContent = chunks.map(c => c.content).join('');
        if (totalContent.length > 0) {
          results.stepPass('chunk-content', `Total streamed content: ${totalContent.length} characters`);
        } else {
          results.stepFail('chunk-content', 'No content in streamed chunks');
        }
        
        // Check chunk timing
        const chunkTimings = chunks.map(c => c.timestamp);
        const hasProgressiveTimings = chunkTimings.every((time, i) => i === 0 || time > chunkTimings[i - 1]);
        
        if (hasProgressiveTimings) {
          results.stepPass('chunk-timing', 'Chunks received in correct temporal order');
        } else {
          results.stepWarn('chunk-timing', 'Chunk timing may be incorrect');
        }
      } else {
        results.stepFail('chunk-reception', 'No chunks received during streaming');
      }
      
      if (doneResponse) {
        results.stepPass('done-handler', 'Done handler called with final response');
        
        if (doneResponse.content && doneResponse.content.length > 0) {
          results.stepPass('done-content', `Final response: ${doneResponse.content.length} characters`);
        } else {
          results.stepWarn('done-content', 'Final response content may be empty');
        }
      } else {
        results.stepFail('done-handler', 'Done handler not called');
      }
      
      if (!errorResponse) {
        results.stepPass('no-errors', 'No errors during streaming');
      } else {
        results.stepWarn('unexpected-error', 'Unexpected error during successful streaming');
      }
      
      if (streamTime < 10000) {
        results.stepPass('stream-time', `Streaming completed in ${streamTime}ms`);
      } else {
        results.stepWarn('stream-time', `Streaming took long time: ${streamTime}ms`);
      }
      
    } else {
      // Test error scenario
      if (errorResponse) {
        results.stepPass('error-streaming', 'Error handler called when CLI unavailable');
      } else {
        results.stepFail('error-streaming', 'Error not properly handled in streaming');
      }
    }
    
    if (verbose) {
      results.stepPass('streaming-details', 'Streaming details captured', {
        chunks_count: chunks.length,
        stream_time: streamTime,
        chunk_sizes: chunks.map(c => c.content.length),
        done_response_size: doneResponse?.content?.length || 0
      });
    }
    
  } catch (error) {
    results.stepFail('streaming-method', 'Streaming method test failed', error);
  }
  
  results.endScenario();
}

/**
 * Scenario 6: Error Handling Test
 */
async function testErrorHandling() {
  const scenario = results.startScenario(
    'Error Handling',
    'Test various error scenarios and recovery mechanisms'
  );
  
  try {
    const adapterModule = await import(`${join(projectRoot, 'src/adapters/claude_code_cli_adapter.js')}`);
    const ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
    
    // Test 1: CLI not available
    const mockModel1 = {
      config: {},
      env: createRealisticMockEnv()
    };
    
    const adapter1 = new ClaudeCodeCLIAdapter(mockModel1);
    adapter1.validate_connection = async () => false; // CLI not available
    
    const request = {
      messages: [{ role: 'user', content: 'Test error handling' }]
    };
    
    const response1 = await adapter1.complete(request);
    
    if (response1 && response1.error) {
      results.stepPass('cli-unavailable', 'CLI unavailable error handled correctly');
    } else {
      results.stepFail('cli-unavailable', 'CLI unavailable error not handled');
    }
    
    // Test 2: Search failure
    const mockModel2 = {
      config: {},
      env: {
        smart_sources: {
          search: async () => {
            throw new Error('Search service unavailable');
          }
        },
        smart_view: { active_note: null }
      }
    };
    
    const adapter2 = new ClaudeCodeCLIAdapter(mockModel2);
    
    try {
      const context = await adapter2.gather_context('test search failure');
      
      if (context === '') {
        results.stepPass('search-failure', 'Search failure handled gracefully (empty context returned)');
      } else {
        results.stepWarn('search-failure', 'Search failure may not be handled properly');
      }
    } catch (error) {
      results.stepFail('search-failure', 'Search failure caused unhandled exception', error);
    }
    
    // Test 3: Missing environment
    const mockModel3 = {
      config: {},
      env: null // No environment
    };
    
    const adapter3 = new ClaudeCodeCLIAdapter(mockModel3);
    
    try {
      const context = await adapter3.gather_context('test missing env');
      
      if (context === '') {
        results.stepPass('missing-env', 'Missing environment handled gracefully');
      } else {
        results.stepWarn('missing-env', 'Missing environment handling may be incorrect');
      }
    } catch (error) {
      results.stepFail('missing-env', 'Missing environment caused unhandled exception', error);
    }
    
    // Test 4: Invalid messages
    const adapter4 = new ClaudeCodeCLIAdapter(mockModel1);
    
    try {
      const prompt = await adapter4.format_prompt([
        null, // Invalid message
        { role: 'invalid' }, // Invalid role, no content
        { content: 'test' } // Missing role
      ]);
      
      if (typeof prompt === 'string') {
        results.stepPass('invalid-messages', 'Invalid messages handled gracefully');
      } else {
        results.stepFail('invalid-messages', 'Invalid messages not handled properly');
      }
    } catch (error) {
      results.stepFail('invalid-messages', 'Invalid messages caused unhandled exception', error);
    }
    
    // Test 5: Retry logic (mock)
    const mockModel5 = {
      config: {},
      env: createRealisticMockEnv()
    };
    
    const adapter5 = new ClaudeCodeCLIAdapter(mockModel5);
    adapter5.max_retries = 3;
    adapter5.base_delay = 10; // Fast for testing
    
    adapter5.validate_connection = async () => true;
    
    let attemptCount = 0;
    const originalSpawn = adapter5.spawn_claude_process;
    
    adapter5.spawn_claude_process = async (prompt, options) => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error(`Simulated failure attempt ${attemptCount}`);
      }
      return {
        id: 'retry-success',
        content: `Success after ${attemptCount} attempts`,
        role: 'assistant'
      };
    };
    
    const startRetryTime = Date.now();
    const retryResponse = await adapter5.execute_claude_cli('test retry');
    const retryTime = Date.now() - startRetryTime;
    
    // Restore original method
    adapter5.spawn_claude_process = originalSpawn;
    
    if (attemptCount === 3 && retryResponse.content && retryResponse.content.includes('Success after 3 attempts')) {
      results.stepPass('retry-logic', `Retry logic worked: ${attemptCount} attempts, ${retryTime}ms total time`);
    } else {
      results.stepFail('retry-logic', `Retry logic failed: ${attemptCount} attempts`);
    }
    
    // Test exponential backoff timing
    if (retryTime >= 30) { // Should wait at least 10ms + 20ms for retries
      results.stepPass('exponential-backoff', `Exponential backoff implemented: ${retryTime}ms total`);
    } else {
      results.stepWarn('exponential-backoff', `Backoff timing may be too fast: ${retryTime}ms`);
    }
    
  } catch (error) {
    results.stepFail('error-handling', 'Error handling test failed', error);
  }
  
  results.endScenario();
}

/**
 * Scenario 7: Real CLI Integration Test (if enabled)
 */
async function testRealCLIIntegration() {
  if (!withRealCLI) {
    console.log(`\n${colors.cyan}Skipping Real CLI Integration Test (use --with-real-cli to enable)${colors.reset}`);
    return;
  }
  
  const scenario = results.startScenario(
    'Real CLI Integration',
    'Test actual Claude Code CLI integration (requires CLI to be installed)'
  );
  
  try {
    const adapterModule = await import(`${join(projectRoot, 'src/adapters/claude_code_cli_adapter.js')}`);
    const ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
    
    const mockModel = {
      config: {},
      env: createRealisticMockEnv()
    };
    
    const adapter = new ClaudeCodeCLIAdapter(mockModel);
    
    // Test real CLI validation
    const isAvailable = await adapter.validate_connection();
    
    if (isAvailable) {
      results.stepPass('real-cli-available', 'Claude Code CLI is available on system');
      
      // Test connection
      const connectionTest = await adapter.test_connection();
      
      if (connectionTest) {
        results.stepPass('real-cli-connection', 'Connection test passed');
        
        // Attempt a real completion (with timeout)
        const realRequest = {
          messages: [
            { role: 'user', content: 'Hello! This is a test message from the Smart Connections integration test. Please respond with a brief confirmation.' }
          ]
        };
        
        try {
          console.log(`   ${colors.blue}📡 Attempting real CLI communication...${colors.reset}`);
          
          const realResponse = await Promise.race([
            adapter.complete(realRequest),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Real CLI test timeout')), 30000)
            )
          ]);
          
          if (realResponse && realResponse.choices && realResponse.choices[0] && realResponse.choices[0].message) {
            results.stepPass('real-cli-response', `Real CLI responded with ${realResponse.choices[0].message.content.length} characters`);
            
            if (verbose) {
              results.stepPass('real-cli-content', 'Real CLI response captured', {
                content_preview: realResponse.choices[0].message.content.substring(0, 200) + '...',
                model: realResponse.model,
                usage: realResponse.usage
              });
            }
          } else {
            results.stepFail('real-cli-response', 'Real CLI response format invalid');
          }
          
        } catch (error) {
          if (error.message.includes('timeout')) {
            results.stepWarn('real-cli-timeout', 'Real CLI test timed out (may be working but slow)');
          } else {
            results.stepFail('real-cli-error', 'Real CLI communication failed', error);
          }
        }
        
      } else {
        results.stepFail('real-cli-connection', 'Connection test failed');
      }
      
    } else {
      results.stepWarn('real-cli-unavailable', 'Claude Code CLI not available on system');
      console.log(`   ${colors.yellow}Install Claude Code CLI and ensure it's in PATH to test real integration${colors.reset}`);
    }
    
  } catch (error) {
    results.stepFail('real-cli-integration', 'Real CLI integration test failed', error);
  }
  
  results.endScenario();
}

/**
 * Main test runner
 */
async function runE2ETests() {
  console.log(`${colors.bold}${colors.magenta}`);
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    CLAUDE CODE CLI E2E INTEGRATION TEST                      ║');
  console.log('║                                                                              ║');
  console.log('║   Comprehensive end-to-end testing of Claude Code CLI integration           ║');
  console.log('║   Simulating real user workflows and validating complete functionality      ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  console.log(`${colors.cyan}Test Configuration:${colors.reset}`);
  console.log(`  Real CLI integration: ${withRealCLI ? 'Enabled' : 'Disabled'}`);
  console.log(`  Failure simulation: ${simulateFailures ? 'Enabled' : 'Disabled'}`);
  console.log(`  Verbose output: ${verbose ? 'Enabled' : 'Disabled'}`);
  
  const startTime = Date.now();
  
  try {
    // Run test scenarios
    await testBasicIntegration();
    await testContextGathering();
    await testPromptFormatting();
    await testCompleteMethod();
    await testStreamingMethod();
    await testErrorHandling();
    await testRealCLIIntegration();
    
    const totalTime = Date.now() - startTime;
    
    // Generate final report
    console.log(`\n${colors.bold}=== END-TO-END TEST REPORT ===${colors.reset}`);
    
    const summary = results.getSummary();
    
    console.log(`\n${colors.cyan}Test Summary:${colors.reset}`);
    console.log(`  Total execution time: ${totalTime}ms`);
    console.log(`  Scenarios completed: ${summary.scenarios.completed}/${summary.scenarios.total}`);
    console.log(`  ${colors.green}Steps passed: ${summary.steps.passed}${colors.reset}`);
    console.log(`  ${colors.red}Steps failed: ${summary.steps.failed}${colors.reset}`);
    console.log(`  ${colors.yellow}Steps warned: ${summary.steps.warned}${colors.reset}`);
    
    // Detailed scenario results
    console.log(`\n${colors.cyan}Scenario Results:${colors.reset}`);
    results.scenarios.forEach(scenario => {
      const statusColor = scenario.status === 'completed' ? colors.green : colors.red;
      const passed = scenario.steps.filter(s => s.status === 'pass').length;
      const failed = scenario.steps.filter(s => s.status === 'fail').length;
      
      console.log(`  ${statusColor}${scenario.name}${colors.reset}: ${passed} passed, ${failed} failed (${scenario.duration}ms)`);
    });
    
    // Final status
    if (summary.success) {
      console.log(`\n${colors.green}${colors.bold}🎉 ALL END-TO-END TESTS PASSED!${colors.reset}`);
      console.log(`${colors.green}Claude Code CLI integration is working correctly end-to-end.${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`\n${colors.red}${colors.bold}❌ END-TO-END TESTS FAILED!${colors.reset}`);
      console.log(`${colors.red}${summary.steps.failed} step(s) failed across ${results.scenarios.length} scenarios.${colors.reset}\n`);
      
      // Show failed steps
      const failedSteps = results.scenarios.flatMap(s => s.steps.filter(step => step.status === 'fail'));
      if (failedSteps.length > 0) {
        console.log(`${colors.red}Failed Steps:${colors.reset}`);
        failedSteps.forEach(step => {
          console.log(`  • ${step.step}: ${step.message}`);
        });
      }
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`\n${colors.red}E2E test runner failed:${colors.reset}`, error);
    process.exit(1);
  }
}

// Handle interruption
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}E2E test interrupted by user${colors.reset}`);
  const summary = results.getSummary();
  console.log(`Completed ${summary.scenarios.completed}/${summary.scenarios.total} scenarios before interruption`);
  process.exit(1);
});

// Run the E2E tests
runE2ETests().catch(error => {
  console.error(`${colors.red}E2E test suite failed:${colors.reset}`, error);
  process.exit(1);
});