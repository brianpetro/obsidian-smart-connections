# Migrating to Claude Code CLI

> **Complete guide to transitioning from external AI APIs to Claude Code CLI integration for enhanced privacy and local processing.**

## Table of Contents

1. [Why Migrate?](#why-migrate)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Migration Steps](#migration-steps)
4. [Settings Migration](#settings-migration)
5. [Feature Comparison](#feature-comparison)
6. [Troubleshooting Migration](#troubleshooting-migration)
7. [Rollback Instructions](#rollback-instructions)
8. [FAQ](#faq)

## Why Migrate?

### Benefits of Claude Code CLI

| Aspect | External APIs | Claude Code CLI |
|--------|---------------|-----------------|
| **Privacy** | Data sent to external servers | Everything stays local |
| **Cost** | Usage-based billing | One-time CLI license |
| **Speed** | Network latency | Local processing |
| **Availability** | Requires internet | Works offline |
| **Rate Limits** | API quotas and throttling | No limits |
| **Data Security** | Third-party handling | Complete control |

### When to Migrate

✅ **Migrate if you value:**
- Maximum privacy and data control
- Offline functionality
- No usage limits or costs
- Faster responses (after initial setup)
- Corporate/enterprise security requirements

⚠️ **Consider staying with APIs if:**
- You need the absolute latest model versions
- System resources are very limited
- You prefer cloud-based processing
- Multiple users need shared access

## Pre-Migration Checklist

### 1. System Requirements
- [ ] **Operating System**: Windows 10+, macOS 10.15+, or modern Linux
- [ ] **Memory**: 8GB RAM minimum (16GB recommended)
- [ ] **Storage**: 2GB free space for Claude Code CLI
- [ ] **CPU**: Multi-core processor (4+ cores recommended)

### 2. Current Configuration Backup
```bash
# Backup your current Smart Connections settings
cp ~/.obsidian/plugins/smart-connections/data.json ~/.obsidian/plugins/smart-connections/data.json.backup
```

### 3. Document Current Setup
Make note of your current configuration:
- [ ] Current AI provider (OpenAI, Anthropic, etc.)
- [ ] Model being used
- [ ] Custom settings or API keys
- [ ] Any custom prompts or configurations

### 4. Test Environment
- [ ] Ensure you can install software on your system
- [ ] Test terminal/command line access
- [ ] Verify PATH environment variable access

## Migration Steps

### Step 1: Install Claude Code CLI

Choose your installation method:

#### Option A: NPM Installation (Recommended)
```bash
# Install globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

#### Option B: Direct Download
1. Visit [https://claude.ai/code](https://claude.ai/code)
2. Download for your platform
3. Follow installation instructions
4. Verify with `claude --version`

### Step 2: Test Claude Code CLI
```bash
# Test basic functionality
echo "Hello, can you help me test this CLI?" | claude

# Check available options
claude --help
```

### Step 3: Configure Smart Connections

1. **Open Obsidian Settings**
   - Go to Settings → Community Plugins → Smart Connections

2. **Navigate to Chat Settings**
   - Select "Smart Chat" from the left sidebar
   - Go to "Models" section

3. **Switch to Claude Code CLI**
   - Change "Chat Model" from your current provider to "Claude Code CLI"
   - Click "Test Connection" to verify

4. **Verify Configuration**
   - You should see: ✅ "Claude Code CLI is available and ready"

### Step 4: Import Conversation History (Optional)

If you want to preserve your existing conversations:

```javascript
// In Developer Console (Ctrl+Shift+I)
// This exports your current chat history
const history = app.plugins.plugins['smart-connections'].main.smart_chat_model.conversations;
console.log(JSON.stringify(history, null, 2));
```

Save this output to a file for reference.

### Step 5: Test Migration

1. **Start a New Conversation**
   - Open Smart Chat
   - Ask a simple question about your vault
   - Verify Claude Code responds with relevant context

2. **Test Context Integration**
   - Ask about specific notes in your vault
   - Verify relevant content is automatically included
   - Check response quality and relevance

3. **Test Performance**
   - Try a complex query
   - Monitor response time
   - Ensure streaming works properly

## Settings Migration

### Configuration Mapping

| Current Setting | Claude Code Equivalent | Notes |
|----------------|----------------------|-------|
| API Key | Not needed | Local processing |
| Model Selection | claude-code-cli | Fixed model |
| Temperature | Not directly configurable | Default behavior |
| Max Tokens | Context length limit | Configurable |
| Custom Instructions | Built into prompts | Auto-generated |

### Advanced Configuration

#### Context Settings
```javascript
// In Smart Connections settings
{
  "claude_code": {
    "max_context_notes": 5,        // Replaces context window management
    "context_length_limit": 1000,  // Per-note character limit
    "semantic_threshold": 0.6      // Relevance filtering
  }
}
```

#### Performance Settings
```javascript
{
  "claude_code": {
    "timeout": 60000,              // Request timeout
    "max_retries": 3,              // Error retry attempts
    "streaming": true              // Enable streaming responses
  }
}
```

### Migrating Custom Prompts

If you had custom system prompts:

**Before (API-based):**
```javascript
{
  "system_prompt": "You are a helpful assistant for my research notes..."
}
```

**After (Claude Code):**
The context-aware prompts are automatically generated, but you can customize behavior through conversation style.

## Feature Comparison

### Features Available in Both

✅ **Preserved Features:**
- Smart Chat interface
- Conversation threading
- File and note references
- Semantic context inclusion
- PDF document chat
- Streaming responses
- Error handling and retries

### New Claude Code Features

🆕 **Enhanced Features:**
- **Automatic Context**: More intelligent vault context
- **Semantic Integration**: Better note discovery
- **Privacy Mode**: Complete local processing
- **Offline Operation**: No internet dependency
- **Unlimited Usage**: No rate limits

### Features Not Available

❌ **Limitations:**
- **Model Selection**: Single Claude model (vs multiple API models)
- **Temperature Control**: Not directly configurable
- **Custom System Prompts**: Auto-generated only
- **Multi-Provider**: Claude Code CLI only

## Troubleshooting Migration

### Common Migration Issues

#### 1. "Claude Code CLI not found"

**Problem**: Smart Connections can't find the CLI
**Solutions**:
```bash
# Check installation
which claude  # macOS/Linux
where claude  # Windows

# Fix PATH issues
export PATH="$PATH:/path/to/claude"

# Reinstall if necessary
npm install -g @anthropic-ai/claude-code
```

#### 2. Poor Performance After Migration

**Problem**: Responses are slower than API
**Solutions**:
- Reduce context size: Lower `max_context_notes`
- Upgrade hardware: More RAM/better CPU
- Optimize vault: Remove unused files
- Check system resources: Close other applications

#### 3. Context Quality Issues

**Problem**: Claude doesn't include relevant notes
**Solutions**:
```javascript
// Adjust semantic search threshold
{
  "semantic_threshold": 0.5,  // Lower = more inclusive
  "max_context_notes": 8      // Higher = more context
}
```

#### 4. Conversation History Lost

**Problem**: Previous conversations don't appear
**Solution**: This is expected. Conversation history is provider-specific and doesn't migrate automatically.

#### 5. Streaming Not Working

**Problem**: Responses appear all at once
**Solutions**:
- Check Claude Code CLI version
- Restart Obsidian
- Disable/re-enable streaming in settings

### Getting Help

If you encounter issues during migration:

1. **Check Logs**: Enable Developer Console and look for errors
2. **Test CLI Directly**: Use `claude --help` to verify CLI works
3. **Restart Everything**: Close Obsidian, restart, try again
4. **Join Community**: Ask for help in Discord or GitHub Issues

## Rollback Instructions

If you need to revert to your previous API configuration:

### Quick Rollback

1. **Restore Settings**
   - Go to Settings → Smart Connections → Smart Chat → Models
   - Select your previous provider (OpenAI, Anthropic, etc.)
   - Re-enter your API key

2. **Restore Backup** (if created)
   ```bash
   # Restore settings backup
   cp ~/.obsidian/plugins/smart-connections/data.json.backup ~/.obsidian/plugins/smart-connections/data.json
   ```

3. **Restart Obsidian**
   - Close and reopen Obsidian
   - Verify your previous configuration is restored

### Complete Rollback

If you want to completely remove Claude Code CLI:

```bash
# Uninstall Claude Code CLI
npm uninstall -g @anthropic-ai/claude-code

# Or remove downloaded binary
rm /path/to/claude-code-cli
```

## FAQ

### General Migration Questions

**Q: Will I lose my conversation history?**
A: Conversation history is provider-specific. You'll start fresh with Claude Code CLI, but your notes and connections remain unchanged.

**Q: How long does migration take?**
A: Typically 10-15 minutes for installation and configuration, plus testing time.

**Q: Can I use both Claude Code and APIs?**
A: You can switch between providers, but only one can be active at a time.

**Q: Is migration reversible?**
A: Yes, you can always switch back to API providers if needed.

### Technical Migration Questions

**Q: Do I need to re-index my vault?**
A: No, Smart Connections' semantic index remains unchanged.

**Q: What about my API credits?**
A: Unused API credits remain in your account with the provider. Migration doesn't affect your API account.

**Q: Will file references still work?**
A: Yes, all Smart Connections features remain the same, just the AI provider changes.

### Performance Migration Questions

**Q: Will responses be faster?**
A: Initially slower due to local processing, but potentially faster than API calls after optimization.

**Q: How much disk space will this use?**
A: Claude Code CLI: ~500MB. Model weights and cache may use additional space.

**Q: What about battery life on laptops?**
A: Local processing uses more CPU/battery than API calls, but eliminates network usage.

---

## Post-Migration Optimization

Once migration is complete, consider these optimizations:

### 1. Context Tuning
- Monitor which notes get included in context
- Adjust semantic threshold for better relevance
- Fine-tune context length limits

### 2. Performance Optimization
- Monitor response times
- Adjust timeout settings if needed
- Optimize vault organization for better search

### 3. Workflow Integration
- Update any documentation about API usage
- Train team members on new local-first approach
- Consider security policy updates

---

**Need Help?** Join our community:
- **Discord**: [Smart Connections Community](https://discord.gg/smart-connections)
- **GitHub**: [Migration Issues](https://github.com/brianpetro/obsidian-smart-connections/issues)
- **Documentation**: [Full Setup Guide](./claude-code-guide.md)

---

*Last updated: 2024-08-26*