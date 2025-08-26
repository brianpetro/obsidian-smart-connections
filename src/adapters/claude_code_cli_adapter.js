import { spawn } from 'child_process';

// Safely import Notice from obsidian, fallback to console.log for testing
let Notice;
if (typeof require !== 'undefined') {
  try {
    const obsidian = require('obsidian');
    Notice = obsidian.Notice;
  } catch (error) {
    // Fallback for testing environment
    Notice = class {
      constructor(message) {
        console.log(`Notice: ${message}`);
      }
    };
  }
} else {
  // Fallback for testing environment
  Notice = class {
    constructor(message) {
      console.log(`Notice: ${message}`);
    }
  };
}

/**
 * @class ClaudeCodeCLIAdapter
 * @description Adapter for integrating Claude Code CLI with Smart Connections.
 * Provides AI completions using local Claude Code CLI process instead of external APIs.
 * 
 * Features:
 * - Process management with timeout and cleanup
 * - Semantic context integration from smart_sources
 * - Exponential backoff retry logic
 * - Proper error handling with user feedback
 * - Support for streaming and non-streaming completions
 */
export class ClaudeCodeCLIAdapter {
  /**
   * @constructor
   * @param {Object} main - The main SmartChatModel instance
   */
  constructor(main) {
    this.main = main;
    this.config = main.config || {};
    this.timeout = 60000; // 60 seconds timeout
    this.max_retries = 3;
    this.base_delay = 1000; // 1 second base delay for exponential backoff
    this.can_stream = true; // Claude Code CLI supports streaming
  }

  /**
   * Validates that Claude Code CLI is available on the system
   * @returns {Promise<boolean>} True if CLI is available, false otherwise
   */
  async validate_connection() {
    try {
      return new Promise((resolve) => {
        const process = spawn('claude', ['--version'], { 
          timeout: 5000,
          stdio: 'ignore' 
        });
        
        process.on('close', (code) => {
          resolve(code === 0);
        });
        
        process.on('error', () => {
          resolve(false);
        });
      });
    } catch (error) {
      console.error('Claude Code CLI validation failed:', error);
      return false;
    }
  }

  /**
   * Gathers semantic context from the vault using smart_sources search
   * @param {string} user_message - The user's message to search context for
   * @returns {Promise<string>} Formatted context string
   */
  async gather_context(user_message) {
    try {
      const env = this.main.env;
      if (!env?.smart_sources) return '';

      // Use semantic search to find relevant content
      const search_results = await env.smart_sources.search(user_message, {
        limit: 5,
        threshold: 0.5
      });

      if (!search_results || search_results.length === 0) return '';

      const context_parts = [];
      
      // Add current active note context if available
      if (env.smart_view?.active_note) {
        const active_note = env.smart_view.active_note;
        context_parts.push(`## Current Note: ${active_note.basename || 'Unknown'}`);
        if (active_note.content && active_note.content.length > 0) {
          context_parts.push(active_note.content.substring(0, 1000) + '...');
        }
      }

      // Add semantic search results
      context_parts.push('## Related Content from Vault:');
      search_results.forEach((result, index) => {
        const source = result.item || result;
        context_parts.push(`### ${index + 1}. ${source.path || source.key}`);
        
        if (source.content) {
          // Limit context length per result
          const content = source.content.length > 500 
            ? source.content.substring(0, 500) + '...'
            : source.content;
          context_parts.push(content);
        }
      });

      return context_parts.join('\n\n');
    } catch (error) {
      console.error('Failed to gather context:', error);
      return '';
    }
  }

  /**
   * Formats the prompt with vault context and conversation history
   * @param {Array} messages - Array of conversation messages
   * @returns {Promise<string>} Formatted prompt for Claude Code CLI
   */
  async format_prompt(messages) {
    const context = await this.gather_context(
      messages[messages.length - 1]?.content || ''
    );

    const prompt_parts = [];
    
    // Add system context about the vault
    prompt_parts.push('You are an AI assistant helping with an Obsidian vault. You have access to the vault contents and conversation history.');
    
    if (context) {
      prompt_parts.push('## Vault Context:');
      prompt_parts.push(context);
    }

    // Add conversation history
    if (messages.length > 0) {
      prompt_parts.push('## Conversation History:');
      messages.forEach((msg, index) => {
        const role = msg.role === 'user' ? 'Human' : 'Assistant';
        prompt_parts.push(`### ${role} ${index + 1}:`);
        prompt_parts.push(msg.content || '');
      });
    }

    return prompt_parts.join('\n\n');
  }

  /**
   * Executes Claude Code CLI with retry logic and proper error handling
   * @param {string} prompt - The formatted prompt to send
   * @param {Object} options - Options for the CLI execution
   * @returns {Promise<Object>} Response object with content or error
   */
  async execute_claude_cli(prompt, options = {}) {
    let last_error = null;

    for (let attempt = 1; attempt <= this.max_retries; attempt++) {
      try {
        const response = await this.spawn_claude_process(prompt, {
          ...options,
          attempt
        });
        
        if (response.error && attempt < this.max_retries) {
          // Exponential backoff before retry
          const delay = this.base_delay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          last_error = response.error;
          continue;
        }
        
        return response;
      } catch (error) {
        last_error = error;
        if (attempt < this.max_retries) {
          const delay = this.base_delay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    // All retries failed
    new Notice(`Claude Code CLI failed after ${this.max_retries} attempts: ${last_error?.message || 'Unknown error'}`);
    return { 
      error: last_error,
      content: "Sorry, I'm having trouble connecting to Claude Code CLI. Please check that it's installed and accessible."
    };
  }

  /**
   * Spawns Claude Code CLI process and manages its lifecycle
   * @param {string} prompt - The prompt to send
   * @param {Object} options - Spawn options
   * @returns {Promise<Object>} Response from CLI process
   */
  async spawn_claude_process(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      const args = ['--format', 'json'];
      if (options.stream) {
        args.push('--stream');
      }

      const claude_process = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.timeout
      });

      let stdout_data = '';
      let stderr_data = '';
      let resolved = false;

      // Set up timeout
      const timeout_id = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          claude_process.kill('SIGTERM');
          reject(new Error(`Claude Code CLI timed out after ${this.timeout}ms`));
        }
      }, this.timeout);

      // Handle stdout data
      claude_process.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout_data += chunk;
        
        // For streaming mode, emit chunks as they arrive
        if (options.stream && options.chunk_handler) {
          try {
            // Try to parse each line as JSON for streaming responses
            const lines = chunk.split('\n').filter(line => line.trim());
            lines.forEach(line => {
              try {
                const parsed = JSON.parse(line);
                if (parsed.content) {
                  options.chunk_handler({
                    id: Date.now().toString(),
                    content: parsed.content,
                    role: 'assistant'
                  });
                }
              } catch (e) {
                // Not JSON, treat as plain text chunk
                options.chunk_handler({
                  id: Date.now().toString(),
                  content: line,
                  role: 'assistant'
                });
              }
            });
          } catch (error) {
            console.warn('Failed to parse streaming chunk:', error);
          }
        }
      });

      // Handle stderr
      claude_process.stderr.on('data', (data) => {
        stderr_data += data.toString();
      });

      // Handle process exit
      claude_process.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout_id);

          if (code === 0) {
            try {
              // Try to parse as JSON first
              let response_content = stdout_data.trim();
              let parsed_response = null;
              
              try {
                parsed_response = JSON.parse(response_content);
                response_content = parsed_response.content || response_content;
              } catch (e) {
                // Not JSON, use as plain text
              }

              resolve({
                id: Date.now().toString(),
                content: response_content,
                role: 'assistant',
                model: 'claude-code-cli',
                usage: parsed_response?.usage || null
              });
            } catch (error) {
              reject(new Error(`Failed to parse Claude Code response: ${error.message}`));
            }
          } else {
            const error_msg = stderr_data || `Claude Code CLI exited with code ${code}`;
            reject(new Error(error_msg));
          }
        }
      });

      // Handle process errors
      claude_process.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout_id);
          
          if (error.code === 'ENOENT') {
            reject(new Error('Claude Code CLI not found. Please install claude CLI and ensure it\'s in your PATH.'));
          } else {
            reject(error);
          }
        }
      });

      // Send the prompt to the process
      try {
        claude_process.stdin.write(prompt);
        claude_process.stdin.end();
      } catch (error) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout_id);
          reject(new Error(`Failed to send prompt to Claude Code CLI: ${error.message}`));
        }
      }
    });
  }

  /**
   * Non-streaming completion method
   * @param {Object} request - The request object with messages
   * @returns {Promise<Object>} Completion response
   */
  async complete(request) {
    try {
      // Validate CLI availability
      const is_available = await this.validate_connection();
      if (!is_available) {
        return {
          error: new Error('Claude Code CLI is not available'),
          content: "Claude Code CLI is not installed or not accessible. Please install it and ensure it's in your PATH."
        };
      }

      const prompt = await this.format_prompt(request.messages || []);
      const response = await this.execute_claude_cli(prompt, { stream: false });
      
      return {
        id: response.id || Date.now().toString(),
        choices: [{
          message: {
            content: response.content,
            role: 'assistant'
          }
        }],
        model: 'claude-code-cli',
        usage: response.usage || {
          prompt_tokens: prompt.length / 4, // Rough estimation
          completion_tokens: response.content?.length / 4 || 0,
          total_tokens: (prompt.length + (response.content?.length || 0)) / 4
        }
      };
    } catch (error) {
      console.error('Claude Code CLI completion error:', error);
      new Notice('Claude Code CLI error: ' + error.message);
      
      return {
        error: error,
        content: "I apologize, but I encountered an error while processing your request. Please try again."
      };
    }
  }

  /**
   * Streaming completion method
   * @param {Object} request - The request object with messages
   * @param {Object} handlers - Handler functions for streaming events
   * @returns {Promise<void>} Promise that resolves when streaming completes
   */
  async stream(request, handlers = {}) {
    try {
      // Validate CLI availability
      const is_available = await this.validate_connection();
      if (!is_available) {
        if (handlers.error) {
          handlers.error({
            error: new Error('Claude Code CLI is not available'),
            content: "Claude Code CLI is not installed or not accessible. Please install it and ensure it's in your PATH."
          });
        }
        return;
      }

      const prompt = await this.format_prompt(request.messages || []);
      
      let accumulated_content = '';
      const response_id = Date.now().toString();
      
      const response = await this.execute_claude_cli(prompt, {
        stream: true,
        chunk_handler: (chunk) => {
          accumulated_content += chunk.content || '';
          
          // Call the chunk handler if provided
          if (handlers.chunk) {
            handlers.chunk({
              id: response_id,
              content: chunk.content || '',
              role: 'assistant',
              delta: { content: chunk.content || '' }
            });
          }
        }
      });

      // Call done handler with final response
      if (handlers.done) {
        handlers.done({
          id: response_id,
          content: accumulated_content,
          role: 'assistant',
          model: 'claude-code-cli',
          choices: [{
            message: {
              content: accumulated_content,
              role: 'assistant'
            }
          }],
          usage: {
            prompt_tokens: prompt.length / 4,
            completion_tokens: accumulated_content.length / 4,
            total_tokens: (prompt.length + accumulated_content.length) / 4
          }
        });
      }
    } catch (error) {
      console.error('Claude Code CLI streaming error:', error);
      new Notice('Claude Code CLI streaming error: ' + error.message);
      
      if (handlers.error) {
        handlers.error({
          error: error,
          content: "I apologize, but I encountered an error while streaming your request. Please try again."
        });
      }
    }
  }

  /**
   * Get available models (for settings UI)
   * @returns {Array<Object>} Array of model configurations
   */
  get models() {
    return [
      {
        id: 'claude-code-cli',
        name: 'Claude Code CLI',
        description: 'Local Claude Code CLI integration'
      }
    ];
  }

  /**
   * Test the connection and show user feedback
   * @returns {Promise<boolean>} True if connection successful
   */
  async test_connection() {
    try {
      const is_available = await this.validate_connection();
      
      if (is_available) {
        new Notice('✅ Claude Code CLI is available and ready');
        return true;
      } else {
        new Notice('❌ Claude Code CLI not found. Please install claude CLI and ensure it\'s in your PATH.');
        return false;
      }
    } catch (error) {
      new Notice('❌ Error testing Claude Code CLI: ' + error.message);
      return false;
    }
  }

  /**
   * Cleanup method to be called when adapter is destroyed
   */
  cleanup() {
    // Any cleanup logic if needed
    console.log('Claude Code CLI adapter cleaned up');
  }
}

export default ClaudeCodeCLIAdapter;