# Installation Walkthrough Examples

> **Step-by-step installation examples for different scenarios and operating systems**

## Table of Contents

1. [Quick Start Examples](#quick-start-examples)
2. [Platform-Specific Walkthroughs](#platform-specific-walkthroughs)
3. [Common Installation Scenarios](#common-installation-scenarios)
4. [Verification Examples](#verification-examples)
5. [Troubleshooting Real Issues](#troubleshooting-real-issues)

## Quick Start Examples

### Example 1: Fresh Installation on macOS

```bash
# Terminal session for complete installation
$ cd ~/Documents/ObsidianVault

$ ls -la .obsidian/plugins/
# If plugins folder doesn't exist:
$ mkdir -p .obsidian/plugins/

$ cd .obsidian/plugins/
$ git clone https://github.com/yourusername/obsidian-smart-connections.git smart-connections

$ cd smart-connections
$ ls
README.md    main.js    manifest.json    styles.css    docs/

# Install Claude Code CLI
$ npm install -g @anthropic-ai/claude-code
npm notice created a lockfile as package-lock.json
+ @anthropic-ai/claude-code@1.0.0
added 52 packages from 40 contributors in 8.234s

# Verify Claude installation
$ claude --version
Claude Code CLI version 1.0.0

# Test Claude directly
$ echo "Hello, Claude!" | claude
Hello! I'm Claude, an AI assistant. How can I help you today?

# Open Obsidian and enable the plugin
```

### Example 2: Windows Installation with Pre-built Release

```powershell
# PowerShell session for Windows users
PS C:\> cd $env:USERPROFILE\Documents\ObsidianVault

# Check if plugins directory exists
PS C:\> Test-Path .obsidian\plugins
False

# Create plugins directory
PS C:\> New-Item -ItemType Directory -Path .obsidian\plugins\smart-connections

# Download release files (example using curl)
PS C:\> cd .obsidian\plugins\smart-connections
PS C:\> curl -O https://github.com/yourusername/obsidian-smart-connections/releases/latest/download/main.js
PS C:\> curl -O https://github.com/yourusername/obsidian-smart-connections/releases/latest/download/manifest.json
PS C:\> curl -O https://github.com/yourusername/obsidian-smart-connections/releases/latest/download/styles.css

# Install Claude Code CLI using npm
PS C:\> npm install -g @anthropic-ai/claude-code

# Add to PATH if needed
PS C:\> [Environment]::SetEnvironmentVariable(
    "Path", 
    $env:Path + ";C:\Users\$env:USERNAME\AppData\Roaming\npm",
    [EnvironmentVariableTarget]::User
)

# Restart PowerShell and verify
PS C:\> claude --version
Claude Code CLI version 1.0.0
```

## Platform-Specific Walkthroughs

### macOS Detailed Walkthrough

#### Step 1: Prepare Vault
```bash
# Navigate to your vault
cd ~/Documents/MyVault

# Check current structure
tree -L 2 .obsidian/
.obsidian/
├── app.json
├── appearance.json
├── core-plugins.json
└── workspace.json
```

#### Step 2: Install Plugin Files
```bash
# Create plugin directory
mkdir -p .obsidian/plugins/smart-connections

# Option A: Clone repository
git clone https://github.com/yourusername/obsidian-smart-connections.git \
  .obsidian/plugins/smart-connections

# Option B: Download release
cd .obsidian/plugins/smart-connections
curl -LO https://github.com/yourusername/obsidian-smart-connections/releases/latest/download/main.js
curl -LO https://github.com/yourusername/obsidian-smart-connections/releases/latest/download/manifest.json
curl -LO https://github.com/yourusername/obsidian-smart-connections/releases/latest/download/styles.css
```

#### Step 3: Install Claude Code CLI
```bash
# Using npm (recommended)
npm install -g @anthropic-ai/claude-code

# Using Homebrew (alternative)
brew tap anthropic/tap
brew install claude-code

# Verify installation
which claude
/usr/local/bin/claude

claude --version
Claude Code CLI version 1.0.0
```

#### Step 4: Configure in Obsidian
```bash
# Open Obsidian from terminal (optional)
open -a Obsidian ~/Documents/MyVault

# Or use Spotlight search to open Obsidian
```

**In Obsidian:**
1. Settings → Community plugins → Turn off Safe Mode
2. Browse → Installed plugins → Find "Smart Connections"
3. Toggle to enable
4. Click gear icon for settings
5. Smart Chat → Models → Select "Claude Code CLI"
6. Click "Test Connection"

### Windows Detailed Walkthrough

#### Using Command Prompt
```cmd
:: Navigate to vault
cd %USERPROFILE%\Documents\ObsidianVault

:: Create plugin directory
mkdir .obsidian\plugins\smart-connections 2>nul

:: Download files using PowerShell from cmd
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yourusername/obsidian-smart-connections/releases/latest/download/main.js' -OutFile '.obsidian\plugins\smart-connections\main.js'"
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yourusername/obsidian-smart-connections/releases/latest/download/manifest.json' -OutFile '.obsidian\plugins\smart-connections\manifest.json'"
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yourusername/obsidian-smart-connections/releases/latest/download/styles.css' -OutFile '.obsidian\plugins\smart-connections\styles.css'"

:: Install Claude CLI
npm install -g @anthropic-ai/claude-code

:: Verify
where claude
claude --version
```

### Linux (Ubuntu/Debian) Walkthrough

```bash
# Navigate to vault
cd ~/Documents/ObsidianVault

# Create plugin structure
mkdir -p .obsidian/plugins/smart-connections

# Clone or download
cd .obsidian/plugins/
git clone https://github.com/yourusername/obsidian-smart-connections.git smart-connections

# Install Node.js if needed
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Claude CLI
sudo npm install -g @anthropic-ai/claude-code

# Fix permissions if needed
sudo chmod +x /usr/local/bin/claude

# Create desktop entry for Obsidian (if using AppImage)
cat > ~/.local/share/applications/obsidian.desktop << EOF
[Desktop Entry]
Name=Obsidian
Exec=/path/to/Obsidian.AppImage %u
Terminal=false
Type=Application
Icon=/path/to/obsidian-icon.png
Categories=Office;
EOF
```

## Common Installation Scenarios

### Scenario 1: Installing in Existing Vault with Many Plugins

```bash
# Check existing plugins
$ ls .obsidian/plugins/
calendar/  dataview/  templater/  tasks/

# Add Smart Connections without affecting others
$ cd .obsidian/plugins/
$ git clone https://github.com/yourusername/obsidian-smart-connections.git smart-connections

# Verify no conflicts
$ grep -r "smart-connections" ../community-plugins.json
# Should return nothing initially

# After enabling in Obsidian, verify it's added
$ cat ../community-plugins.json | python -m json.tool | grep smart
    "smart-connections"
```

### Scenario 2: Installing for Development

```bash
# Clone to development location
cd ~/Development
git clone https://github.com/yourusername/obsidian-smart-connections.git
cd obsidian-smart-connections

# Install dependencies
npm install

# Set up for hot-reload development
echo "DESTINATION_VAULTS=TestVault,DevVault" > .env

# Build and watch
npm run dev

# Output shows:
[build] watching for changes...
[build] initial build complete
[build] copying to TestVault/.obsidian/plugins/smart-connections/
[build] copying to DevVault/.obsidian/plugins/smart-connections/
```

### Scenario 3: Migrating from Obsidian Plugin Store Version

```bash
# Backup existing installation
cd .obsidian/plugins/
cp -r smart-connections smart-connections-backup

# Check current version
cat smart-connections/manifest.json | grep version
"version": "2.0.0"

# Remove store version
rm -rf smart-connections

# Install enhanced version
git clone https://github.com/yourusername/obsidian-smart-connections.git smart-connections

# Verify new version
cat smart-connections/manifest.json | grep version
"version": "3.0.0"

# Settings are preserved in Obsidian's data.json
```

## Verification Examples

### Complete Verification Process

```bash
# 1. Verify plugin files
$ ls -la .obsidian/plugins/smart-connections/
-rw-r--r--  1 user  staff  2048576  Aug 26 10:00 main.js
-rw-r--r--  1 user  staff     1234  Aug 26 10:00 manifest.json
-rw-r--r--  1 user  staff    45678  Aug 26 10:00 styles.css

# 2. Verify Claude CLI
$ claude --version
Claude Code CLI version 1.0.0

# 3. Test Claude processing
$ echo "What is 2+2?" | claude
2 + 2 = 4

# 4. Check Obsidian console for errors
# Open DevTools: Cmd/Ctrl+Shift+I
# Console should show:
Smart Connections v3.0.0 loaded
Claude Code CLI adapter registered
Embeddings initialized

# 5. Test Smart Chat
# Create test note with content
$ echo "# Test Note\nThis is a test for Smart Connections" > TestNote.md

# In Smart Chat, type: "What's in my test note?"
# Should respond with context from TestNote.md
```

### Checking Embedding Generation

```bash
# Monitor embedding generation
$ watch -n 1 'ls -la .smart-env/*.json | tail -5'

# Check embedding progress in Obsidian
# Bottom right notices show:
"Embedding notes... 45/150"
"Embedding complete!"

# Verify embeddings created
$ ls .smart-env/
embeddings_1.json
embeddings_2.json
notes.ajson
blocks.ajson

# Check file sizes (should be non-zero)
$ du -h .smart-env/*.json
1.2M    embeddings_1.json
856K    embeddings_2.json
```

## Troubleshooting Real Issues

### Issue 1: "Claude Code CLI not found"

**Actual Terminal Session:**
```bash
$ claude --version
-bash: claude: command not found

# Solution 1: Check npm global installation
$ npm list -g @anthropic-ai/claude-code
/usr/local/lib
└── (empty)

# Reinstall
$ npm install -g @anthropic-ai/claude-code

# Solution 2: Fix PATH
$ echo $PATH
/usr/local/bin:/usr/bin:/bin

# Add npm global bin to PATH
$ echo 'export PATH="$PATH:$(npm config get prefix)/bin"' >> ~/.zshrc
$ source ~/.zshrc

# Verify fix
$ which claude
/usr/local/bin/claude
```

### Issue 2: "Plugin not loading in Obsidian"

**Debugging Steps:**
```javascript
// Open Console (Cmd/Ctrl+Shift+I)
// Check for errors:
app.plugins.plugins
// Should list all plugins

app.plugins.plugins['smart-connections']
// undefined means not loaded

// Check manifest
app.vault.adapter.read('.obsidian/plugins/smart-connections/manifest.json')
// Should return manifest content

// Check for load errors
app.plugins.enablePlugin('smart-connections')
// Watch for error messages
```

### Issue 3: "Embeddings not generating"

**Terminal Investigation:**
```bash
# Check disk space
$ df -h .
Filesystem     Size   Used  Avail Capacity
/dev/disk1s1   500G   450G   50G    90%

# Check permissions
$ ls -la .smart-env/
drwxr-xr-x  5 user  staff   160 Aug 26 10:00 .
drwxr-xr-x  8 user  staff   256 Aug 26 10:00 ..

# Fix permissions if needed
$ chmod -R 755 .smart-env/

# Check for locked files
$ lsof | grep smart-env
# Should be empty or show Obsidian process only

# Force refresh embeddings
# In Obsidian: Settings → Smart Connections → Force Refresh All Embeddings
```

### Issue 4: "High Memory Usage"

**Monitoring and Fix:**
```bash
# Monitor memory usage
$ top -o MEM | grep -E "Obsidian|claude"
12345 Obsidian  0.0  03:45.67 8   0   384  1.2G  0B   1.1G  12345
12346 claude    0.0  00:12.34 2   0   45   384M  0B   350M  12346

# Kill orphaned processes
$ pkill -f claude

# Optimize settings for large vault
# In settings, adjust:
# - Batch Size: 5 (from 10)
# - Max Context Sources: 3 (from 5)
# - Exclude folders: Archive/, Attachments/
```

## Platform-Specific Tips

### macOS Tips
```bash
# Allow Obsidian and Claude in Security settings
$ spctl --add /Applications/Obsidian.app
$ xattr -d com.apple.quarantine /usr/local/bin/claude

# Use Activity Monitor to check resources
$ open -a "Activity Monitor"
```

### Windows Tips
```powershell
# Run as Administrator if permission issues
# Right-click PowerShell → Run as Administrator

# Check Windows Defender isn't blocking
Get-MpPreference | Select-Object ExclusionPath

# Add exclusion if needed
Add-MpPreference -ExclusionPath "$env:USERPROFILE\Documents\ObsidianVault\.smart-env"
```

### Linux Tips
```bash
# Use system monitor
$ gnome-system-monitor &

# Check SELinux/AppArmor isn't blocking
$ sudo ausearch -m avc -ts recent | grep obsidian
$ sudo aa-status | grep obsidian

# Add firewall exception if needed (shouldn't be necessary)
$ sudo ufw status
```

---

[← Back to Documentation](../README.md) | [Installation Guide](../installation.md) | [Common Workflows →](./common-workflows.md)