/**
 * @fileoverview Example usage of ClaudeCodeCLIAdapter with Smart Connections
 * This file demonstrates how to use the Claude Code CLI adapter in practice
 */

import { ClaudeCodeCLIAdapter } from './claude_code_cli_adapter.js';

/**
 * Example usage of the ClaudeCodeCLIAdapter
 * This shows how the adapter would be used within Smart Connections
 */
export async function example_usage() {
  // Mock SmartChatModel for demonstration
  const mockSmartChatModel = {
    env: {
      smart_sources: {
        search: async (query, options) => [
          {
            item: {
              path: 'example/note.md',
              content: 'This is example content from the vault that relates to: ' + query
            }
          },
          {
            item: {
              path: 'another/document.md',
              content: 'Additional context that might be helpful for the user query.'
            }
          }
        ]
      },
      smart_view: {
        active_note: {
          basename: 'current-working-note.md',
          content: 'The user is currently working on this note with some important context about their project.'
        }
      }
    },
    config: {
      claude_code_cli: {
        timeout: 60000,
        max_retries: 3,
        base_delay: 1000,
        context_limit: 5
      }
    }
  };

  // Initialize the adapter
  const adapter = new ClaudeCodeCLIAdapter(mockSmartChatModel);

  // Test connection
  console.log('Testing connection...');
  const isConnected = await adapter.test_connection();
  if (!isConnected) {
    console.log('Claude Code CLI not available');
    return;
  }

  // Example 1: Non-streaming completion
  console.log('\n=== Non-streaming Example ===');
  const request = {
    messages: [
      {
        role: 'user',
        content: 'Can you help me understand the main concepts in my vault related to machine learning?'
      }
    ]
  };

  try {
    const response = await adapter.complete(request);
    console.log('Response:', response.choices[0].message.content);
    console.log('Usage:', response.usage);
  } catch (error) {
    console.error('Completion error:', error);
  }

  // Example 2: Streaming completion
  console.log('\n=== Streaming Example ===');
  const streamRequest = {
    messages: [
      {
        role: 'user',
        content: 'What are some action items I should focus on based on my current note?'
      }
    ]
  };

  try {
    await adapter.stream(streamRequest, {
      chunk: (chunk) => {
        process.stdout.write(chunk.content || '');
      },
      done: (response) => {
        console.log('\n\nStreaming completed.');
        console.log('Final response usage:', response.usage);
      },
      error: (error) => {
        console.error('Streaming error:', error);
      }
    });
  } catch (error) {
    console.error('Stream initialization error:', error);
  }

  // Cleanup
  adapter.cleanup();
}

/**
 * Example of how to integrate with Smart Connections settings
 */
export function get_adapter_settings_config() {
  return {
    claude_code_cli: {
      name: 'Claude Code CLI',
      description: 'Use local Claude Code CLI for AI completions',
      settings: [
        {
          key: 'timeout',
          name: 'Timeout (ms)',
          type: 'number',
          default: 60000,
          description: 'Maximum time to wait for Claude Code CLI response'
        },
        {
          key: 'max_retries',
          name: 'Max Retries',
          type: 'number',
          default: 3,
          description: 'Number of retry attempts on failure'
        },
        {
          key: 'base_delay',
          name: 'Base Retry Delay (ms)',
          type: 'number',
          default: 1000,
          description: 'Base delay for exponential backoff between retries'
        },
        {
          key: 'context_limit',
          name: 'Context Results Limit',
          type: 'number',
          default: 5,
          description: 'Maximum number of semantic search results to include as context'
        }
      ]
    }
  };
}

/**
 * Example integration with Smart Connections chat interface
 */
export class SmartConnectionsClaudeCodeIntegration {
  constructor(smartEnv) {
    this.env = smartEnv;
    this.adapter = new ClaudeCodeCLIAdapter(smartEnv.smart_chat_model);
  }

  async handle_user_message(message, thread_id) {
    // Get conversation history from thread
    const thread = this.env.smart_threads?.get(thread_id);
    const messages = thread ? thread.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })) : [];

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    // Use Claude Code CLI to generate response
    try {
      const response = await this.adapter.complete({ messages });
      
      // Save response to thread
      if (thread) {
        thread.add_message({
          role: 'assistant',
          content: response.choices[0].message.content,
          model: 'claude-code-cli',
          timestamp: Date.now()
        });
      }

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Claude Code CLI integration error:', error);
      return "I apologize, but I'm having trouble processing your request right now. Please try again.";
    }
  }

  async handle_streaming_message(message, thread_id, onChunk) {
    const thread = this.env.smart_threads?.get(thread_id);
    const messages = thread ? thread.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    })) : [];

    messages.push({
      role: 'user',
      content: message
    });

    let accumulated_content = '';

    await this.adapter.stream({ messages }, {
      chunk: (chunk) => {
        accumulated_content += chunk.content || '';
        if (onChunk) {
          onChunk(chunk.content || '');
        }
      },
      done: (response) => {
        // Save complete response to thread
        if (thread) {
          thread.add_message({
            role: 'assistant',
            content: accumulated_content,
            model: 'claude-code-cli',
            timestamp: Date.now()
          });
        }
      },
      error: (error) => {
        console.error('Streaming error:', error);
        if (onChunk) {
          onChunk('\n\n[Error: Failed to complete response]');
        }
      }
    });
  }

  cleanup() {
    this.adapter.cleanup();
  }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  example_usage().catch(console.error);
}