# Claude Code CLI Integration Specification

## Overview
Replace Smart Connections' external API providers with local Claude Code CLI integration, maintaining the familiar chat interface while ensuring all AI processing happens locally within Obsidian.

## Final Requirements

### Core Functionality
- **CLI Process Management**: Spawn `claude` processes from within Obsidian plugin
- **Context Intelligence**: Use semantic search to provide relevant vault context
- **UI Continuity**: Maintain existing Smart Connections chat interface
- **Local Processing**: Eliminate all external API dependencies
- **Retry Logic**: Handle Claude Code process failures gracefully

### Technical Architecture

```javascript
// src/adapters/claude_code_cli_adapter.js
class ClaudeCodeCLIAdapter {
  constructor(env) {
    this.env = env;
    this.retryConfig = {
      maxRetries: 3,
      delays: [1000, 2000, 4000] // exponential backoff
    };
  }

  async sendMessage(message, conversationId) {
    const context = await this.gatherVaultContext(message);
    return await this.executeWithRetry(() => 
      this.spawnClaudeProcess(context, message)
    );
  }

  async gatherVaultContext(message) {
    // Semantic search for relevant notes
    const relevantNotes = await this.env.smart_sources.search(message, { limit: 20 });
    const currentNote = this.env.smart_view.active_note;
    const conversationHistory = await this.getRecentHistory(5);
    
    return {
      relevantNotes: relevantNotes.map(note => ({
        title: note.title,
        content: note.content,
        path: note.path
      })),
      currentNote,
      conversationHistory
    };
  }

  async spawnClaudeProcess(context, message) {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const prompt = this.formatPrompt(context, message);
      const claudeProcess = spawn('claude', [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: this.env.vault_path
      });

      let response = '';
      let error = '';

      claudeProcess.stdout.on('data', (data) => {
        response += data.toString();
      });

      claudeProcess.stderr.on('data', (data) => {
        error += data.toString();
      });

      claudeProcess.on('close', (code) => {
        if (code === 0) {
          resolve(response.trim());
        } else {
          reject(new Error(`Claude process exited with code ${code}: ${error}`));
        }
      });

      // Send prompt to Claude
      claudeProcess.stdin.write(prompt);
      claudeProcess.stdin.end();

      // Timeout after 60 seconds
      setTimeout(() => {
        claudeProcess.kill();
        reject(new Error('Claude process timed out'));
      }, 60000);
    });
  }

  formatPrompt(context, message) {
    return `You are an AI assistant helping with personal knowledge management in Obsidian.

Current Note: ${context.currentNote?.title || 'None'}

Recent Conversation:
${context.conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Relevant Vault Context:
${context.relevantNotes.map(note => `## ${note.title}\n${note.content}`).join('\n\n')}

User Message: ${message}

Please provide a helpful response based on the vault context and conversation history.`;
  }

  async executeWithRetry(operation) {
    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === this.retryConfig.maxRetries - 1) {
          throw error;
        }
        
        // Show retry message to user
        this.showRetryMessage(attempt + 1);
        
        // Wait before retry
        await new Promise(resolve => 
          setTimeout(resolve, this.retryConfig.delays[attempt])
        );
      }
    }
  }

  showRetryMessage(attemptNumber) {
    new Notice(`Claude Code unavailable, retrying... (attempt ${attemptNumber}/3)`);
  }
}
```

### Integration Points

1. **Replace Chat Model in smart_env.config.js**:
```javascript
// Remove existing smart_chat_model configuration
// Add Claude Code CLI adapter
modules: {
  claude_code: {
    class: ClaudeCodeCLIAdapter,
    // No external HTTP adapter needed
  }
}
```

2. **Update Chat Interface**:
- Keep existing `SmartChatView` 
- Replace backend calls to use `ClaudeCodeCLIAdapter`
- Maintain conversation threading and history

3. **Remove Dependencies**:
- Remove all external API provider adapters
- Remove `smart-http-request` dependency
- Simplify configuration to Claude Code only

## Implementation Tasks

### Phase 1: Core Claude Code Bridge (Week 1)
- [ ] **Task 1.1**: Create `ClaudeCodeCLIAdapter` class
  - File: `src/adapters/claude_code_cli_adapter.js`
  - Implement basic process spawning
  - Add prompt formatting
  - Include timeout handling

- [ ] **Task 1.2**: Implement context gathering system
  - Use existing semantic search (`smart_sources.search()`)
  - Include current note context
  - Format context for Claude Code consumption

- [ ] **Task 1.3**: Add retry logic with exponential backoff
  - Maximum 3 retry attempts
  - Delays: 1s, 2s, 4s
  - User feedback via Obsidian notices

### Phase 2: Integration & Testing (Week 2)
- [ ] **Task 2.1**: Update smart_env.config.js
  - Replace `smart_chat_model` with `claude_code` module
  - Remove external provider configurations
  - Test configuration loading

- [ ] **Task 2.2**: Modify chat interface backend
  - Update `SmartChatView` to use Claude Code adapter
  - Maintain existing UI/UX
  - Test conversation flow

- [ ] **Task 2.3**: Implement conversation history management
  - Store conversation context for context continuity
  - Limit history to last 5 exchanges
  - Include in Claude Code prompts

### Phase 3: Cleanup & Optimization (Week 3)
- [ ] **Task 3.1**: Remove external dependencies
  - Remove unused AI provider adapters
  - Clean up `package.json` dependencies
  - Remove HTTP request modules if unused elsewhere

- [ ] **Task 3.2**: Add error handling & user feedback
  - Clear error messages for common failures
  - Help text for Claude Code setup
  - Status indicators in chat interface

- [ ] **Task 3.3**: Performance optimization
  - Optimize context size for faster processing
  - Add process cleanup to prevent leaks
  - Test with large vault sizes

### Phase 4: Documentation & Polish (Week 4)
- [ ] **Task 4.1**: Update documentation
  - Update README with Claude Code requirements
  - Add troubleshooting guide
  - Document new configuration options

- [ ] **Task 4.2**: Add tests
  - Unit tests for Claude Code adapter
  - Integration tests for chat flow
  - Error scenario testing

- [ ] **Task 4.3**: User experience improvements
  - Better loading indicators
  - Cancel operation capability
  - Context preview option

## Acceptance Criteria

```gherkin
GIVEN I have Smart Connections with Claude Code integration
AND Claude Code CLI is available on my system
WHEN I send a chat message in the Smart Connections interface
THEN Claude Code processes my message locally
AND relevant vault notes are automatically included as context
AND I receive an intelligent response within reasonable time
AND no external API calls are made

GIVEN Claude Code CLI is temporarily unavailable
WHEN I send a chat message
THEN the system automatically retries up to 3 times
AND I see retry progress notifications
AND if all retries fail, I get a clear error message
AND the semantic search functionality still works

GIVEN I'm having an ongoing conversation
WHEN I send follow-up messages
THEN Claude Code receives previous conversation context
AND maintains continuity across exchanges
AND includes newly relevant vault content
```

## Success Metrics

- **Privacy**: Zero external API calls during chat operations
- **Functionality**: All existing chat features work with Claude Code backend  
- **Performance**: 95% of responses complete within 30 seconds
- **Reliability**: 90% success rate with retry logic
- **User Experience**: Familiar interface with enhanced local intelligence

## Risk Mitigation

1. **Claude Code Availability**: Clear setup documentation and error messages
2. **Process Management**: Proper cleanup and timeout handling
3. **Context Size**: Intelligent limiting to prevent overwhelming Claude Code
4. **Performance**: Asynchronous processing with user feedback

---

*This specification provides the complete roadmap for transforming Smart Connections into a Claude Code-powered personal AI second brain while maintaining the familiar user experience.*