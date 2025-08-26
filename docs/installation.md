[← Back to Documentation](./README.md) | [Home](../README.md)

---

# Installation Guide

> **Complete guide to installing Enhanced Smart Connections with Claude Code CLI integration**

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation Methods](#installation-methods)
   - [Method 1: Pre-built Release (Recommended for Users)](#method-1-pre-built-release)
   - [Method 2: Build from Source (For Developers)](#method-2-build-from-source)
3. [Claude Code CLI Setup](#claude-code-cli-setup)
4. [Plugin Configuration](#plugin-configuration)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Next Steps](#next-steps)

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Obsidian** | v1.0.0 | Latest stable |
| **Node.js** | v18.0.0 | v20.0.0+ |
| **Memory** | 4GB RAM | 8GB+ RAM |
| **Storage** | 500MB free | 2GB+ free |
| **OS** | Windows 10, macOS 10.15, Linux | Latest versions |

### Required Software

- **Obsidian**: Download from [obsidian.md](https://obsidian.md)
- **Claude Code CLI** (for AI features): Install instructions below
- **Git** (for development): [git-scm.com](https://git-scm.com)
- **Node.js & npm** (for building): [nodejs.org](https://nodejs.org)

## Installation Methods

### Method 1: Pre-built Release

**Best for: End users who want to use the plugin without building from source**

#### Step 1: Download Plugin Files

1. Visit the [Releases page](https://github.com/yourusername/obsidian-smart-connections/releases)
2. Download the latest release assets:
   - `main.js` - The compiled plugin code
   - `manifest.json` - Plugin metadata
   - `styles.css` - Plugin styling

#### Step 2: Install in Obsidian

1. **Open your vault folder**
   - Windows: `C:\Users\YourName\Documents\ObsidianVault`
   - macOS: `/Users/YourName/Documents/ObsidianVault`
   - Linux: `~/Documents/ObsidianVault`

2. **Navigate to plugins directory**
   ```bash
   cd .obsidian/plugins/
   ```
   
   If the plugins folder doesn't exist, create it:
   ```bash
   mkdir -p .obsidian/plugins/
   ```

3. **Create plugin folder**
   ```bash
   mkdir smart-connections
   cd smart-connections
   ```

4. **Copy downloaded files**
   - Move `main.js`, `manifest.json`, and `styles.css` into the `smart-connections` folder

#### Step 3: Enable the Plugin

1. Open Obsidian
2. Go to Settings → Community plugins
3. Turn off "Safe mode" if it's enabled
4. Find "Smart Connections" in the list
5. Click the toggle to enable it

### Method 2: Build from Source

**Best for: Developers, contributors, or users who want the latest development version**

#### Step 1: Clone the Repository

```bash
# Clone this repository
git clone https://github.com/yourusername/obsidian-smart-connections.git
cd obsidian-smart-connections
```

#### Step 2: Set Up JSBrains Dependencies

The Smart Connections ecosystem uses local file dependencies. Ensure the following directory structure:

```
parent-directory/
├── obsidian-smart-connections/  (this repo)
├── jsbrains/                    (dependency modules)
│   ├── smart-blocks/
│   ├── smart-collections/
│   ├── smart-embed-model/
│   └── ...
├── smart-chat-obsidian/
└── smart-context-obsidian/
```

Clone the required dependencies:
```bash
cd ..
git clone https://github.com/brianpetro/jsbrains.git
git clone https://github.com/brianpetro/smart-chat-obsidian.git
git clone https://github.com/brianpetro/smart-context-obsidian.git
cd obsidian-smart-connections
```

#### Step 3: Install Dependencies

```bash
# Install npm packages
npm install

# Verify JSBrains links
npm ls | grep "file:"
```

#### Step 4: Build the Plugin

```bash
# Build for production
npm run build

# Or build with watch mode for development
npm run dev
```

#### Step 5: Deploy to Vault

**Option A: Manual Copy**
```bash
# Copy built files to your vault
cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/smart-connections/
```

**Option B: Automated Deployment**
Create a `.env` file:
```env
DESTINATION_VAULTS=my-vault-name,another-vault
```

Then build will auto-deploy:
```bash
npm run build
```

## Claude Code CLI Setup

### Installing Claude Code CLI

#### Method 1: NPM (Recommended)

```bash
# Install globally via npm
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

#### Method 2: Direct Download

1. Visit [claude.ai/code](https://claude.ai/code)
2. Download the appropriate version for your OS
3. Follow the platform-specific installation instructions

#### Method 3: Platform-Specific Installers

**macOS (Homebrew)**:
```bash
brew install anthropic/tap/claude-code
```

**Windows (Scoop)**:
```bash
scoop bucket add anthropic https://github.com/anthropic-ai/scoop-bucket
scoop install claude-code
```

**Linux (Snap)**:
```bash
sudo snap install claude-code
```

### Configuring PATH

Ensure Claude Code CLI is accessible from anywhere:

**macOS/Linux**:
```bash
echo 'export PATH="$PATH:/usr/local/bin"' >> ~/.bashrc
source ~/.bashrc
```

**Windows**:
1. Open System Properties → Advanced → Environment Variables
2. Add Claude Code installation directory to PATH
3. Restart Obsidian

## Plugin Configuration

### Initial Setup

1. **Open Smart Connections Settings**
   - Click the gear icon next to Smart Connections in Community plugins
   - Or use Command Palette: "Smart Connections: Open Settings"

2. **Configure Smart Chat**
   ```
   Settings → Smart Chat → Models
   - Model Provider: Claude Code CLI
   - Model: claude-3-opus (default)
   - Context Length: 200000 (default)
   ```

3. **Configure Smart Connections**
   ```
   Settings → Smart Connections
   - Embedding Model: TaylorAI/bge-micro-v2 (local, default)
   - Min Length for Embeddings: 300 (default)
   - Show Full Path: Toggle based on preference
   ```

4. **Configure Privacy Settings**
   ```
   Settings → Smart Environment
   - Excluded Files: Add patterns for private files
   - Excluded Folders: Add private folders
   - Save location: .smart-env/ (keep local)
   ```

### Testing the Connection

1. **Test Claude Code CLI**
   - In Smart Chat settings, click "Test Connection"
   - Should show: "✅ Claude Code CLI is properly configured"

2. **Test Embeddings**
   - Open any note
   - Check Smart Connections panel
   - Should show related notes after initial processing

## Verification

### Verify Installation

Run these checks to ensure everything is working:

1. **Check Plugin Status**
   ```
   Obsidian Console (Ctrl/Cmd+Shift+I):
   > app.plugins.plugins['smart-connections']
   ```

2. **Check Claude Code CLI**
   ```bash
   claude --version
   # Should output: Claude Code CLI version X.X.X
   ```

3. **Check Embeddings**
   - Look for `.smart-env/` folder in your vault
   - Should contain `embeddings_X.json` files

4. **Test Chat Feature**
   - Open Smart Chat (ribbon icon or command)
   - Type: "Hello, can you see my notes?"
   - Should respond with context awareness

### Performance Check

Monitor initial setup:
- First embedding generation: 5-30 minutes (depends on vault size)
- Subsequent updates: Near instant for changed files
- Chat responses: 1-3 seconds with local processing

## Troubleshooting

### Common Issues

#### Plugin Not Appearing
- Ensure Obsidian is updated to latest version
- Check that Safe Mode is disabled
- Verify files are in correct location: `.obsidian/plugins/smart-connections/`

#### Claude Code CLI Not Found
```bash
# Check installation
which claude  # macOS/Linux
where claude  # Windows

# Reinstall if needed
npm uninstall -g @anthropic-ai/claude-code
npm install -g @anthropic-ai/claude-code
```

#### Embeddings Not Generating
- Check console for errors (Ctrl/Cmd+Shift+I)
- Verify `.smart-env/` folder permissions
- Try "Refresh All Embeddings" in settings
- Ensure sufficient disk space

#### Build Failures
```bash
# Clear and rebuild
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Getting Help

- **Documentation**: [Full documentation](./README.md)
- **Issues**: [GitHub Issues](https://github.com/yourusername/obsidian-smart-connections/issues)
- **Community**: [Obsidian Forum](https://forum.obsidian.md)
- **Discord**: [Obsidian Discord](https://discord.gg/obsidianmd)

## Next Steps

### After Installation

1. **Read the User Guide**: [user-guide.md](./user-guide.md)
   - Learn about features and workflows
   - Configure advanced settings
   - Optimize for your use case

2. **Set Up Claude Code Integration**: [claude-code-integration.md](./claude-code-integration.md)
   - Advanced configuration options
   - Privacy and security settings
   - Performance optimization

3. **For Developers**: [development.md](./development.md)
   - Development environment setup
   - Contributing guidelines
   - Testing procedures

### Tips for New Users

- **Start Small**: Let initial embeddings complete before heavy use
- **Exclude Large Files**: PDFs, images can slow embedding generation
- **Use Folder References**: `[[folder/]]` to include entire folders in chat
- **Privacy First**: Review excluded folders before first use

---

[← Documentation Hub](./README.md) | [User Guide →](./user-guide.md) | [Examples →](./examples/installation-walkthrough.md)