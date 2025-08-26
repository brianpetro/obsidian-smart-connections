# Enhanced Smart Connections - Privacy-First Obsidian Plugin with Claude Code CLI

> **A personal implementation with enhanced local AI processing capabilities**  
> Based on the original [Smart Connections plugin](https://github.com/brianpetro/obsidian-smart-connections) by Brian Petro

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Obsidian Plugin](https://img.shields.io/badge/obsidian-plugin-7C3AED.svg)](https://obsidian.md)
[![Privacy First](https://img.shields.io/badge/privacy-first-green.svg)](docs/claude-code-integration.md)

## 🚀 What Makes This Implementation Different

This enhanced implementation of Smart Connections focuses on **complete privacy and local processing** while maintaining all the powerful features of the original plugin:

### **🔐 Privacy by Default**
- **Claude Code CLI Integration**: 100% local AI processing - your data never leaves your machine
- **No API Keys Required**: No costs, no rate limits, no external dependencies
- **Offline Capable**: Works completely offline after initial setup

### **⚡ Enhanced Features**
- **Intelligent Context Building**: Automatically includes relevant vault content in AI conversations
- **Deep Semantic Search**: Leverages powerful embedding models for finding related content
- **Smart Migration**: Easy transition from API-based solutions to local processing
- **Performance Optimized**: Specially tuned for large vaults with thousands of notes

### **🛠️ Developer Friendly**
- **Complete Build Documentation**: Full instructions for building from source
- **JSBrains Ecosystem**: Advanced modular architecture for extensibility
- **Comprehensive Test Suite**: Including Claude Code integration tests
- **Active Development**: Regular updates and improvements

## 📦 Installation

### For End Users (Pre-built Release)

1. **Download the Latest Release**
   - Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest)
   - Or clone this repository for the development version

2. **Install in Obsidian**
   - Create folder: `VaultFolder/.obsidian/plugins/smart-connections/`
   - Copy the downloaded files into this folder
   - Reload Obsidian
   - Enable "Smart Connections" in Settings → Community Plugins

3. **Set Up Claude Code CLI** (for local AI)
   ```bash
   # Install via npm (recommended)
   npm install -g @anthropic-ai/claude-code
   
   # Or download from https://claude.ai/code
   ```

4. **Configure the Plugin**
   - Open Smart Connections settings
   - Go to Smart Chat → Models
   - Select "Claude Code CLI" as your chat model
   - Click "Test Connection" to verify setup

### For Developers (Build from Source)

See [Development Setup Guide](docs/development.md) for complete instructions including JSBrains ecosystem setup.

```bash
# Quick start for developers
git clone https://github.com/yourusername/obsidian-smart-connections.git
cd obsidian-smart-connections
npm install
npm run build
```

## 🎯 Quick Start Guide

### 1. Enable Smart Connections
After installation, Smart Connections immediately begins creating local embeddings for semantic search - no API key required!

![](./assets/SC-OP-notices-embedding-complete-2025-05-20.png)

### 2. Start Chatting with Your Notes
Open Smart Chat from the ribbon or command palette. With Claude Code CLI enabled, your conversations automatically include relevant context from your vault.

### 3. Find Related Content
The Connections view shows semantically similar notes to your current file, helping you discover forgotten connections and insights.

### 4. Privacy-First Configuration
All processing happens locally by default. Your notes never leave your computer unless you explicitly configure external APIs.

## ✨ Core Features

### 🔍 Smart Connections (Semantic Search)
- **Zero-setup local embeddings** using Transformers.js
- **Real-time updates** as you write
- **Block-level connections** for granular insights
- **Exclusion patterns** for private content

### 💬 Smart Chat with Claude Code CLI
- **100% local processing** with Claude's capabilities
- **Automatic context inclusion** from relevant notes
- **File/folder references** for targeted conversations
- **PDF support** - drag research papers directly into chat

### 🎯 Additional Capabilities
- **Multiple language support** via local models
- **Mobile compatibility** with optimized performance
- **Simple data format** for easy backup and migration
- **Lightweight bundle** (~1 MB) for fast loading

## 📚 Documentation

- **[Installation Guide](docs/installation.md)** - Detailed setup instructions
- **[Claude Code Integration](docs/claude-code-integration.md)** - Complete Claude CLI setup and usage
- **[User Guide](docs/user-guide.md)** - Feature walkthrough and best practices
- **[Development Guide](docs/development.md)** - Build from source and contribute
- **[Architecture Overview](docs/architecture.md)** - Technical deep dive

## 🙏 Attribution & Acknowledgments

### Original Creator
This project is based on the excellent [Smart Connections plugin](https://github.com/brianpetro/obsidian-smart-connections) created by **Brian Petro**. Brian's vision of user-aligned, privacy-first tools has been foundational to this work.

### Smart Environment Architecture
The core SmartEnv architecture and Smart Collections system were designed and built by Brian Petro. This implementation extends and enhances these foundations while maintaining compatibility with the original design principles.

### Community Contributions
Special thanks to the Smart Connections community for their invaluable feedback, testing, and contributions that have shaped both the original plugin and this enhanced implementation.

### Mission & Values
This implementation continues Brian's mission of creating user-aligned tools that empower individuals while respecting privacy. As Brian says: "Smart Connections isn't an alternative. It's a catalyst for you and I to realize our most extraordinary visions for the future."

## 🛡️ Privacy & Security

### Your Data Stays Local
- **Embeddings**: Generated and stored locally in `.smart-env/`
- **Chat Processing**: Claude Code CLI runs entirely on your machine
- **No Telemetry**: Zero tracking or analytics
- **Open Source**: Full code transparency for security auditing

### Configuration for Maximum Privacy
1. Use Claude Code CLI (default) for chat
2. Keep local embedding model (default)
3. Exclude sensitive folders in settings
4. Store `.smart-env/` locally (not in cloud sync)

## 🧪 Development

### Prerequisites
- Node.js 18+ and npm
- Obsidian (for testing)
- Claude Code CLI (for full functionality)
- JSBrains dependencies (see [development guide](docs/development.md))

### Building from Source
```bash
# Clone the repository
git clone https://github.com/yourusername/obsidian-smart-connections.git
cd obsidian-smart-connections

# Install dependencies (including JSBrains ecosystem)
npm install

# Build the plugin
npm run build

# Run tests
npm test

# Test Claude Code integration specifically
npm run test:claude-code
```

### Testing in Obsidian
The build system can automatically copy files to your test vault:
```bash
# Set in .env file
DESTINATION_VAULTS=my-test-vault

# Build and auto-deploy
npm run build
```

## 🤝 Contributing

Contributions are welcome! This implementation focuses on:
- Privacy-first enhancements
- Local processing capabilities
- Developer experience improvements
- Performance optimizations

Please read the [development guide](docs/development.md) before contributing.

## 📊 User Testimonials

The Smart Connections plugin has transformed how thousands of users work with their notes. Here's what the community says:

> "Smart Connections is revolutionary for my process of attempting to wrangle decades of sprawling unorganized notes, journals etc. Amazing work!" - Ronny

> "I've switched over from Mem to Obsidian when I found this plugin"

> "This plugin has become a vital part of my life"

> "It's astonishing the power it provides to deal with scientific research and scientific articles included in the vault."

> "Smart Connections changed my life. The earliest adopters gave me critical feedback that improved the software and provided financial support that enabled me to focus on the project full-time." - Brian Petro (Creator)

[See more testimonials →](https://smartconnections.app/smart-connections-love/)

## 🔧 Troubleshooting

### Claude Code CLI Not Detected?
1. Verify installation: `claude --version`
2. Check PATH configuration
3. Restart Obsidian after installation
4. See [Claude Code Setup Guide](docs/claude-code-integration.md#troubleshooting)

### Embeddings Not Generating?
1. Check `.smart-env/` folder permissions
2. Ensure sufficient disk space
3. Try "Refresh All Embeddings" in settings
4. Check console for error messages (Ctrl/Cmd+Shift+I)

### Performance Issues?
1. Exclude large folders or file types
2. Adjust embedding batch size in settings
3. Use block-level embeddings for large files
4. See [Performance Optimization Guide](docs/user-guide.md#performance)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Original Smart Connections**: [GitHub](https://github.com/brianpetro/obsidian-smart-connections) | [Website](https://smartconnections.app)
- **Claude Code CLI**: [Official Site](https://claude.ai/code)
- **Documentation**: [Full Docs](docs/)
- **Issues**: [Report Bugs](../../issues)
- **Discussions**: [Community Forum](../../discussions)

---

<p align="center">
Built with ❤️ for the Obsidian community<br>
<em>Privacy-first AI for your second brain</em>
</p>