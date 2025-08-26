# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-26-claude-code-local-default/spec.md

## Technical Requirements

### Configuration Alignment
- Update all three configuration layers (root, main, thread defaults) to use Claude Code CLI as the consistent default
- Modify base SmartThreads class in `smart-chat-v0/smart_threads.js` to replace OpenAI defaults
- Ensure `adapter: 'claude_code_cli'` and `model_key: 'claude-code-cli'` are set consistently
- Remove or comment out API-based provider defaults to prevent fallback confusion

### UI/UX Specifications
- Implement conditional rendering in settings UI to hide API key fields when Claude Code CLI is active
- Add visual indicator showing "Local Processing Active" status in the chat interface
- Create simplified settings panel specifically for Claude Code CLI options (timeout, retry count, context limits)
- Display helpful setup guidance if Claude Code CLI is not detected on the system

### First-Run Experience
- Implement availability check for Claude Code CLI on plugin initialization
- Show installation guide with platform-specific instructions if CLI not found
- Auto-configure optimal settings for local processing (reasonable timeouts, context limits)
- Validate CLI functionality with a test command before enabling chat

### Migration Requirements
- Detect existing configurations for OpenAI, Anthropic, or other API providers
- Offer one-click migration option in settings or via notification
- Preserve all chat threads, messages, and user preferences during migration
- Update thread configurations to use Claude Code CLI while maintaining history

### Performance Criteria
- Context retrieval should complete within 2 seconds for typical vaults
- CLI response streaming should begin within 3 seconds of request
- Process cleanup must occur within 500ms of chat completion
- Memory usage should not exceed 500MB for typical chat sessions

## Integration Requirements

### SmartThreads Integration
- Update `constructor` defaults in `smart_threads.js` to use Claude Code CLI
- Modify `get_default_settings()` to return Claude Code CLI configuration
- Ensure backward compatibility for existing threads with API configurations

### Settings Tab Integration
- Enhance `sc_settings_tabs.js` to conditionally show/hide API sections
- Add new section for Claude Code CLI specific settings
- Implement migration button/dialog for existing API users

### Smart Chat View Integration
- Update status indicators in `smart_chat.js` to show local processing
- Add helpful error messages specific to Claude Code CLI issues
- Implement retry logic with user-friendly feedback

### Configuration File Updates
- Primary: `src/smart_env.config.js` - already has Claude Code CLI as default
- Secondary: `smart-chat-v0/smart_threads.js` - needs default update
- Settings: Ensure consistency across all configuration points