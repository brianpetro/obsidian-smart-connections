# Claude Code Integration Setup Guide

> **Complete guide to setting up Claude Code CLI with Smart Connections for the ultimate privacy-first AI experience.**

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Usage](#usage)
5. [Troubleshooting](#troubleshooting)
6. [Performance Optimization](#performance-optimization)
7. [Privacy & Security](#privacy--security)
8. [FAQ](#faq)

## Overview

Claude Code CLI integration transforms Smart Connections into a completely local, privacy-first AI assistant. Unlike traditional API-based solutions, **everything happens on your machine** - no data is ever sent to external servers.

### Key Benefits

- **🔒 Maximum Privacy**: Your notes never leave your computer
- **⚡ Smart Context**: Automatically includes relevant vault content
- **🧠 Semantic Integration**: Leverages Smart Connections' powerful search
- **💡 Familiar Interface**: Same Smart Chat experience you know
- **🛡️ Zero Dependencies**: No API keys, rate limits, or internet required

### How It Works

```mermaid
graph LR
    A[Your Message] --> B[Smart Connections]
    B --> C[Semantic Search]
    C --> D[Context Gathering]
    D --> E[Claude Code CLI]
    E --> F[Local Processing]
    F --> G[Smart Response]
    G --> H[Chat Interface]
```

Smart Connections automatically:
1. Searches your vault for relevant content using semantic embeddings
2. Builds intelligent context from your notes
3. Sends everything to Claude Code CLI locally
4. Displays the response in the familiar Smart Chat interface

## Installation

### Method 1: NPM Installation (Recommended)

```bash
# Install Claude Code CLI globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

### Method 2: Direct Download

1. Visit [https://claude.ai/code](https://claude.ai/code)
2. Download the appropriate installer for your platform:
   - **Windows**: `claude-code-windows.exe`
   - **macOS**: `claude-code-macos.dmg`
   - **Linux**: `claude-code-linux.AppImage`
3. Follow the installer instructions
4. Verify installation by opening terminal and running `claude --version`

### Platform-Specific Notes

#### Windows
- Ensure Claude Code CLI is added to your system PATH
- You may need to restart your terminal after installation
- If you encounter permission issues, run as Administrator

#### macOS
- You may need to allow the app in Security & Privacy settings
- Use Homebrew alternative: `brew install anthropic-claude-code`
- Grant terminal permissions if prompted

#### Linux
- Make the AppImage executable: `chmod +x claude-code-linux.AppImage`
- Add to PATH or create a symlink: `ln -s /path/to/claude-code-linux.AppImage /usr/local/bin/claude`

## Configuration

### 1. Enable Claude Code in Smart Connections

1. Open Obsidian and go to **Settings** → **Community Plugins** → **Smart Connections**
2. Navigate to **Smart Chat** → **Models**
3. Select **"Claude Code CLI"** from the model dropdown
4. Click **"Test Connection"** to verify setup
5. Save settings

### 2. Advanced Configuration Options

#### Context Settings
Customize how much context is included with your queries:

```javascript
// In Smart Connections settings
{
  "claude_code": {
    "max_context_notes": 5,        // Maximum relevant notes to include
    "context_length_limit": 1000,   // Characters per note
    "include_current_note": true,   // Always include active note
    "semantic_threshold": 0.5       // Relevance threshold (0-1)
  }
}
```

#### Performance Settings
```javascript
{
  "claude_code": {
    "timeout": 60000,              // 60 second timeout
    "max_retries": 3,              // Retry attempts
    "retry_delay": 1000,           // Base delay between retries (ms)
    "streaming": true              // Enable streaming responses
  }
}
```

### 3. Testing Your Setup

Use the built-in connection test:

1. Go to Smart Connections settings
2. Navigate to Smart Chat → Models → Claude Code CLI
3. Click **"Test Connection"**

You should see: ✅ **Claude Code CLI is available and ready**

If you see an error, proceed to the [Troubleshooting](#troubleshooting) section.

## Usage

### Basic Chat

1. **Open Smart Chat**:
   - Click the Smart Connections icon in the ribbon
   - Or use Command Palette: `Smart Chat: Open`

2. **Start Conversations**:
   - Type your message and press Enter
   - Claude Code processes everything locally
   - Relevant vault content is automatically included

### Advanced Features

#### Context-Aware Conversations
Smart Connections automatically includes relevant notes based on your query:

```
You: "How do I implement authentication in React?"

Claude receives:
- Your question
- Related notes about React
- Authentication notes from your vault
- Current note context (if relevant)
```

#### File References
Mention specific files or concepts in your vault:

```
You: "Based on my project-notes.md, what should I focus on next?"

Claude receives:
- Your question  
- Content from project-notes.md
- Related project files
- Recent conversation history
```

#### Research Assistance
Perfect for academic or professional research:

```
You: "Summarize the key findings from my research papers about AI ethics"

Claude receives:
- Your question
- All relevant research notes
- Papers and citations in your vault
- Connected concepts and ideas
```

## Troubleshooting

### Common Issues & Solutions

#### 1. "Claude Code CLI not found"

**Symptoms**: Error message when testing connection or sending messages

**Solutions**:
```bash
# Check if Claude is in PATH
which claude  # macOS/Linux
where claude  # Windows

# If not found, add to PATH or reinstall
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

#### 2. "Permission denied" or "Access denied"

**macOS/Linux**:
```bash
# Make executable
chmod +x /path/to/claude

# Check permissions
ls -la /path/to/claude
```

**Windows**:
- Run as Administrator
- Check antivirus software isn't blocking
- Ensure Claude is in a writable directory

#### 3. "Process timed out"

**Symptoms**: Long wait times, timeout errors

**Solutions**:
- Increase timeout in settings (60s → 120s)
- Reduce context size (fewer notes, shorter excerpts)
- Check system resources (CPU, memory)
- Close other resource-intensive applications

#### 4. "Context too large"

**Symptoms**: Error about prompt being too long

**Solutions**:
```javascript
// Reduce context settings
{
  "max_context_notes": 3,        // Fewer notes
  "context_length_limit": 500,   // Shorter excerpts
  "semantic_threshold": 0.7      // Higher relevance threshold
}
```

#### 5. Streaming Issues

**Symptoms**: Responses appear all at once instead of streaming

**Solutions**:
- Check Claude Code CLI version (update if needed)
- Disable streaming in settings if problematic
- Restart Obsidian after configuration changes

### Debug Mode

Enable detailed logging for troubleshooting:

1. Open Developer Console: `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (macOS)
2. Go to Console tab
3. Send a message in Smart Chat
4. Look for Claude Code CLI-related log entries
5. Report issues with log details

### Getting Help

If you're still experiencing issues:

1. **Check GitHub Issues**: [Smart Connections Issues](https://github.com/brianpetro/obsidian-smart-connections/issues)
2. **Join Discord**: [Smart Connections Community](https://discord.gg/smart-connections)
3. **Report Bugs**: Include Claude Code version, OS, error messages, and steps to reproduce

## Performance Optimization

### System Requirements

**Minimum**:
- 4GB RAM
- 2GB free disk space
- Modern CPU (2015+)

**Recommended**:
- 8GB+ RAM
- SSD storage
- Multi-core CPU
- Dedicated GPU (optional)

### Optimization Tips

#### 1. Context Management
```javascript
// Optimal settings for most users
{
  "max_context_notes": 3-5,       // Sweet spot for relevance vs speed
  "context_length_limit": 800,    // Good balance of context and performance
  "semantic_threshold": 0.6       // Filter out less relevant content
}
```

#### 2. Vault Organization
- **Tag Important Notes**: Use consistent tagging for better search
- **Organize by Topics**: Group related notes in folders
- **Regular Cleanup**: Archive or delete outdated content
- **Optimize Note Length**: Break very long notes into smaller ones

#### 3. System Optimization
- **Close Unused Apps**: Free up system resources
- **SSD Storage**: Faster file access improves performance
- **Adequate RAM**: Prevent swapping during processing
- **Background Processes**: Minimize other AI/ML applications

#### 4. Network Considerations
Although Claude Code runs locally, ensure:
- Stable internet for initial setup
- Obsidian Sync configured properly
- No VPN interference with local processes

### Performance Monitoring

Track performance metrics:
```javascript
// Enable performance logging
console.time('Claude Code Response');
// ... after response
console.timeEnd('Claude Code Response');
```

Typical response times:
- **Simple queries**: 2-5 seconds
- **Complex context**: 5-15 seconds  
- **Large vault search**: 10-30 seconds

## Privacy & Security

### Data Handling

Claude Code CLI integration ensures maximum privacy:

#### ✅ What Stays Local
- **All your notes and content**
- **Conversation history**
- **Search queries and results**  
- **Context and metadata**
- **Processing and computation**

#### ✅ What Never Leaves Your Machine
- **Personal information**
- **Proprietary content**
- **Sensitive documents**
- **Research data**
- **Private conversations**

### Security Best Practices

#### 1. System Security
- Keep Claude Code CLI updated
- Use secure operating systems
- Enable disk encryption
- Regular security updates

#### 2. Vault Security  
- Use Obsidian's built-in encryption for sensitive vaults
- Regular backups (encrypted)
- Access controls on shared systems
- Audit vault contents periodically

#### 3. Process Isolation
Claude Code runs in isolated processes:
- No network access during processing
- Sandboxed execution environment
- Temporary file cleanup
- Memory clearing after completion

### Compliance & Regulations

This local-first approach helps with:
- **GDPR Compliance**: Data never leaves EU
- **HIPAA Requirements**: Healthcare data stays local
- **Corporate Policies**: Sensitive business data protected
- **Academic Research**: Confidential research data secure

### Privacy Verification

Verify Claude Code's local operation:

```bash
# Monitor network activity (should be minimal)
netstat -an | grep claude  # Should show minimal/no connections

# Check process isolation
ps aux | grep claude       # View process details

# Verify no external API calls
tcpdump -i any host api.anthropic.com  # Should show no traffic
```

## FAQ

### General Questions

**Q: How is this different from using ChatGPT or Claude directly?**
A: Your data never leaves your computer, and Smart Connections automatically includes relevant vault context with every query.

**Q: Does this require an internet connection?**
A: Only for initial installation. Once set up, everything works offline.

**Q: Can I still use other AI providers?**
A: Yes! Claude Code is just another model option. You can switch between different providers in settings.

**Q: How much does this cost?**
A: After initial Claude Code CLI setup, there are no ongoing costs. No API fees, no subscription costs, no per-message charges - unlimited local usage.

### Technical Questions

**Q: What happens if Claude Code CLI crashes?**
A: Smart Connections includes retry logic and error handling. Failed requests are automatically retried up to 3 times.

**Q: Can I customize the prompts sent to Claude?**
A: Currently, prompts are automatically generated based on context. Custom prompt templates may be added in future versions.

**Q: Does this work with large vaults (10,000+ notes)?**
A: Yes, but performance depends on your system. Smart Connections' semantic search efficiently finds relevant content without processing the entire vault.

**Q: Can I use this on mobile?**
A: Currently, Claude Code CLI is desktop-only. Mobile support depends on Anthropic's roadmap.

### Privacy Questions

**Q: Is my data really never sent online?**
A: Correct. Claude Code processes everything locally. You can verify this by monitoring network activity.

**Q: What about telemetry or analytics?**
A: Smart Connections doesn't send usage data. Check Claude Code CLI's privacy policy for their practices.

**Q: Can I use this in a corporate environment?**
A: Yes, the local-first approach is ideal for corporate use. Check with your IT department about installing additional software.

### Performance Questions

**Q: Why are responses slower than online Claude?**
A: Local processing trades some speed for complete privacy. Optimization tips above can help improve performance.

**Q: How much disk space does this use?**
A: Claude Code CLI itself is relatively small (~500MB). The model weights are the largest component.

**Q: Can I run this on older hardware?**
A: Basic functionality works on older systems, but performance may be limited. See system requirements above.

---

## Support & Community

- **Documentation**: [Smart Connections Docs](https://smartconnections.app/docs)
- **GitHub**: [Report Issues](https://github.com/brianpetro/obsidian-smart-connections/issues)
- **Discord**: [Join Community](https://discord.gg/smart-connections)
- **Updates**: [Release Notes](https://github.com/brianpetro/obsidian-smart-connections/releases)

---

*Last updated: 2024-08-26 | Version: 3.0*