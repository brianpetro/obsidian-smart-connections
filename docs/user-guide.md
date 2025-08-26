# User Guide

> **Complete guide to using Enhanced Smart Connections for maximum productivity**

## Table of Contents

1. [Getting Started](#getting-started)
2. [Smart Connections (Semantic Search)](#smart-connections-semantic-search)
3. [Smart Chat with Claude](#smart-chat-with-claude)
4. [Advanced Features](#advanced-features)
5. [Privacy & Security](#privacy--security)
6. [Performance Optimization](#performance-optimization)
7. [Workflows & Use Cases](#workflows--use-cases)
8. [Troubleshooting](#troubleshooting)
9. [Tips & Best Practices](#tips--best-practices)

## Getting Started

### First Launch

When you first enable Smart Connections:

1. **Initial Embedding Generation**
   - The plugin automatically begins creating embeddings for your notes
   - Progress appears in Obsidian notices (bottom right)
   - Duration: 5-30 minutes depending on vault size
   - You can use Obsidian normally during this process

2. **Default Configuration**
   - Local embedding model (TaylorAI/bge-micro-v2) - no API needed
   - Claude Code CLI for chat (if installed)
   - Privacy-first settings enabled

3. **Quick Verification**
   - Open any note
   - Check the Smart Connections panel (right sidebar)
   - Should show related notes once embeddings complete

### Understanding the Interface

#### Smart Connections Panel

![Smart Connections Panel](../assets/SC-OP-connections-view-2025-05-20.png)

**Key Elements:**
- **Connection Score**: 0.00-1.00 (higher = more similar)
- **Note Title**: Click to open the note
- **Preview**: Hover to see content preview
- **Refresh Button**: Update connections for current note

#### Smart Chat View

**Access Methods:**
- Click ribbon icon (message bubble)
- Command palette: "Smart Chat: Open chat"
- Keyboard shortcut (customizable)

**Interface Components:**
- **Thread Selector**: Switch between conversation threads
- **Message Input**: Type your questions/prompts
- **Context Indicator**: Shows which notes are being referenced
- **Response Area**: AI responses with markdown formatting

## Smart Connections (Semantic Search)

### How It Works

Smart Connections uses AI embeddings to find semantically related content:

1. **Embedding Generation**: Converts text to mathematical vectors
2. **Similarity Calculation**: Compares vectors using cosine similarity
3. **Ranking**: Orders results by relevance score
4. **Display**: Shows most related content in panel

### Connection Types

#### Note-Level Connections
Shows entire notes related to your current note:
- Best for discovering related topics
- Useful for linking ideas across your vault

#### Block-Level Connections
Shows specific paragraphs or sections:
- More granular insights
- Finds specific relevant passages
- Enable in settings: "Show blocks in connections"

### Customizing Results

#### Filtering Options

```markdown
Settings → Smart Connections → Display
- Results count: 20 (default, max 100)
- Show full path: Toggle for folder context
- Show blocks: Include block-level results
- Minimum similarity: 0.5 (adjust threshold)
```

#### Exclusion Patterns

Exclude files or folders from connections:

```markdown
Settings → Smart Environment → File Exclusions
- Add patterns: *.pdf, *.png, *.jpg
- Exclude folders: Templates/, Archive/, Private/
- Exclude by frontmatter: exclude_from_connections: true
```

### Smart View (Dynamic Codeblocks)

Use codeblocks to embed connections anywhere:

````markdown
```smart-connections
Note Title or [[wikilink]]
```
````

This creates a dynamic list of connections that updates automatically.

## Smart Chat with Claude

### Setting Up Claude Code CLI

1. **Install Claude CLI** (if not done):
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```

2. **Configure in Settings**:
   ```
   Smart Chat → Models → Claude Code CLI
   ```

3. **Test Connection**:
   Click "Test" button to verify setup

### Basic Chat Usage

#### Starting a Conversation

1. Open Smart Chat view
2. Type your message
3. Press Enter or click Send

**Example Prompts:**
- "Summarize my notes on project management"
- "What are the main themes in my journal entries?"
- "Help me understand the connections between [[Note A]] and [[Note B]]"

### Advanced Chat Features

#### Folder References

Include entire folders in context:

```markdown
Chat with my [[Projects/]] folder
Tell me about [[Daily Notes/2024/]]
```

#### File References

Reference specific files:

```markdown
Analyze [[My Document]]
Compare [[Note1]] with [[Note2]]
```

#### Multiple References

Combine multiple sources:

```markdown
Using [[Folder/]] and [[Specific Note]], explain...
```

### Context Management

#### Automatic Context

Smart Chat automatically includes:
- Current active note
- Recently viewed notes
- Semantically related content

#### Manual Context Control

```markdown
Settings → Smart Chat → Context
- Max sources: 10 (number of notes to include)
- Context length: 2000 tokens per source
- Include system prompt: Toggle
```

#### Context Indicators

Look for these in chat:
- 📎 Attached files
- 🔗 Linked notes included
- 🧠 Smart context added

## Advanced Features

### PDF Support

Drag and drop PDFs directly into chat:

1. **Drag PDF** into chat window
2. **Automatic extraction** of text content
3. **Full context** available for questions

**Use Cases:**
- Research paper analysis
- Document summarization
- Cross-reference with notes

### Thread Management

#### Creating Threads

- **New Thread**: Click + button or Cmd/Ctrl+N in chat
- **Name Threads**: Right-click to rename
- **Organize**: Group by topic or project

#### Thread Features

- **Persistent History**: All threads saved
- **Search Threads**: Find past conversations
- **Export Threads**: Save as markdown

### Smart Templates

Create reusable chat templates:

```markdown
# Daily Review Template
Based on [[Daily Notes/{{date}}]], provide:
1. Key accomplishments
2. Pending tasks
3. Important insights
```

### Integration with Other Plugins

#### Dataview Queries

```markdown
Chat: "Analyze these tasks"
\`\`\`dataview
TASK WHERE !completed
\`\`\`
```

#### Templater

Use Templater variables in chat:

```markdown
Summarize notes from <% tp.date.now("YYYY-MM") %>
```

## Privacy & Security

### Local-First Architecture

**What stays local:**
- All embeddings (`.smart-env/` folder)
- Chat history (Obsidian data)
- Claude Code CLI processing
- Your notes and content

**What never leaves your machine:**
- Note contents (unless you use external APIs)
- Personal information
- File structure
- Metadata

### Security Best Practices

1. **Exclude Sensitive Content**
   ```
   Settings → File Exclusions
   Add: Passwords/, Financial/, Personal/
   ```

2. **Local Storage Only**
   - Don't sync `.smart-env/` folder
   - Keep chat history local
   - Use encrypted vaults for sensitive data

3. **API Key Management** (if using external services)
   - Never commit API keys
   - Use environment variables
   - Rotate keys regularly

## Performance Optimization

### For Large Vaults (1000+ notes)

#### Optimize Embeddings

```markdown
Settings → Smart Environment
- Batch size: 10 (reduce for slower systems)
- Min length: 500 (increase to skip short notes)
- Max length: 10000 (cap long documents)
```

#### Exclude Unnecessary Content

- Large binary files
- Generated content
- Archive folders
- Media files

#### Performance Settings

```markdown
Settings → Performance
- Debounce delay: 2000ms (reduce updates)
- Cache duration: 3600s (cache results longer)
- Background processing: Enable
```

### Memory Management

#### Clear Caches

```markdown
Command Palette → Smart Connections: Clear cache
```

#### Rebuild Embeddings

```markdown
Settings → Force refresh all embeddings
```

#### Monitor Resource Usage

- Check `.smart-env/` folder size
- Monitor Obsidian memory usage
- Use Activity Monitor/Task Manager

## Workflows & Use Cases

### Research Workflow

1. **Collect Sources**: Import PDFs and web clips
2. **Generate Embeddings**: Let Smart Connections index
3. **Discover Connections**: Find related research
4. **Chat Analysis**: Ask Claude to synthesize findings

### Writing Workflow

1. **Brainstorm**: Chat about your topic
2. **Find References**: Use connections panel
3. **Outline**: Create structure with Claude's help
4. **Draft**: Write with context-aware assistance

### Learning Workflow

1. **Note Taking**: Capture learning materials
2. **Connection Discovery**: Find related concepts
3. **Synthesis**: Use chat to explain relationships
4. **Review**: Chat with your notes for recall

### Project Management

1. **Project Folders**: Organize by project
2. **Context Chat**: `[[Projects/ProjectName/]]`
3. **Status Updates**: Generate summaries
4. **Task Analysis**: Find related tasks and dependencies

## Troubleshooting

### Common Issues

#### Connections Not Showing

**Symptoms**: Empty connections panel

**Solutions**:
1. Wait for initial embeddings to complete
2. Check file exclusions aren't too broad
3. Verify `.smart-env/` folder exists
4. Try "Force refresh" in settings

#### Chat Not Responding

**Symptoms**: No response from Claude

**Solutions**:
1. Verify Claude CLI installed: `claude --version`
2. Check PATH configuration
3. Test connection in settings
4. Restart Obsidian

#### Slow Performance

**Symptoms**: Lag, high CPU usage

**Solutions**:
1. Increase debounce delay
2. Exclude large folders
3. Reduce batch size
4. Clear caches

#### Embedding Errors

**Symptoms**: Error notifications

**Solutions**:
1. Check disk space
2. Verify folder permissions
3. Look for corrupt files
4. Check console logs (Ctrl/Cmd+Shift+I)

### Getting Help

#### Self-Help Resources

- **Console Logs**: Ctrl/Cmd+Shift+I for debugging
- **Documentation**: Check all guides in `/docs`
- **Settings Reset**: Back up and reset preferences

#### Community Support

- [GitHub Issues](https://github.com/yourusername/obsidian-smart-connections/issues)
- [Obsidian Forum](https://forum.obsidian.md)
- [Discord Community](https://discord.gg/obsidianmd)

## Tips & Best Practices

### Effective Prompting

#### Be Specific
❌ "Tell me about my notes"
✅ "Summarize key themes in my [[Philosophy]] folder from 2024"

#### Provide Context
❌ "What should I do?"
✅ "Based on my [[Project Plan]], what are the next three priorities?"

#### Use References
❌ "Explain the concept"
✅ "Explain the concept discussed in [[Machine Learning Basics]]"

### Organization Tips

1. **Consistent Naming**: Use clear, descriptive titles
2. **Folder Structure**: Group related content
3. **Tags**: Use for cross-cutting themes
4. **Links**: Connect related notes manually

### Daily Practices

1. **Morning Review**: Chat with yesterday's notes
2. **Evening Synthesis**: Ask for daily summary
3. **Weekly Connections**: Review new connections
4. **Monthly Analysis**: Deep dive into themes

### Advanced Techniques

#### Chain Prompting
```markdown
1. "Identify main themes in [[Research/]]"
2. "For each theme, find supporting evidence"
3. "Create a synthesis with citations"
```

#### Comparative Analysis
```markdown
"Compare approaches in [[Method A]] vs [[Method B]]"
"What patterns exist across [[Daily Notes/2024]]?"
```

#### Creative Applications
```markdown
"Generate article ideas from [[Blog Drafts/]]"
"Find surprising connections in my [[Random Thoughts]]"
```

## Keyboard Shortcuts

### Default Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Open Smart Chat | Ctrl+Shift+C | Cmd+Shift+C |
| New Chat Thread | Ctrl+N | Cmd+N |
| Toggle Connections | Ctrl+Shift+S | Cmd+Shift+S |
| Refresh Connections | F5 | F5 |
| Clear Chat | Ctrl+L | Cmd+L |

### Customization

```markdown
Settings → Hotkeys → Search "Smart"
- Assign custom shortcuts
- Remove conflicts
- Create command chains
```

## Privacy Settings Checklist

- [ ] Claude Code CLI configured (local processing)
- [ ] Sensitive folders excluded
- [ ] `.smart-env/` not in cloud sync
- [ ] API keys secured (if using)
- [ ] Chat history stored locally
- [ ] Embeddings generated locally
- [ ] No telemetry enabled

---

[← Installation](./installation.md) | [Architecture →](./architecture.md)