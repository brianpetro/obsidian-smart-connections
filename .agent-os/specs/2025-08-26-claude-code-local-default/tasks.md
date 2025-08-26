# Spec Tasks

## Tasks

- [x] 1. Update Configuration Defaults
  - [x] 1.1 Write tests for configuration hierarchy validation
  - [x] 1.2 Update SmartThreads base defaults to use `claude_code_cli` adapter
  - [x] 1.3 Ensure all configuration layers consistently use Claude Code CLI
  - [x] 1.4 Update model_key references from `gpt-4o` to `claude-code-cli`
  - [x] 1.5 Remove or comment out OpenAI-specific default configurations
  - [x] 1.6 Verify all tests pass

- [x] 2. Enhance Settings UI for Local-First Experience
  - [x] 2.1 Write tests for conditional UI rendering based on adapter type
  - [x] 2.2 Implement conditional hiding of API key fields when Claude Code CLI is active
  - [x] 2.3 Add clear "Local Processing Active" status indicator
  - [x] 2.4 Create simplified settings panel for Claude Code CLI options
  - [x] 2.5 Update settings descriptions to emphasize local processing benefits
  - [x] 2.6 Verify all tests pass

- [x] 3. Improve First-Run Experience
  - [x] 3.1 Write tests for Claude Code CLI availability detection
  - [x] 3.2 Implement initialization check for Claude Code CLI on plugin load
  - [x] 3.3 Create user-friendly setup guide for missing CLI installation
  - [x] 3.4 Add automatic optimal settings configuration for local processing
  - [x] 3.5 Implement helpful error messages with actionable steps
  - [x] 3.6 Verify all tests pass

- [x] 4. Create Migration Path from API Providers
  - [x] 4.1 Write tests for detecting existing API configurations
  - [x] 4.2 Implement detection logic for OpenAI/Anthropic configurations
  - [x] 4.3 Create one-click migration utility to Claude Code CLI
  - [x] 4.4 Ensure chat history preservation during migration
  - [x] 4.5 Add migration confirmation dialog with benefits explanation
  - [x] 4.6 Verify all tests pass

- [x] 5. Update Documentation and User Guidance
  - [x] 5.1 Update README.md to highlight Claude Code CLI as primary option
  - [x] 5.2 Create quick-start guide for local AI setup
  - [x] 5.3 Update plugin manifest description to mention local processing
  - [x] 5.4 Add troubleshooting section for common Claude Code CLI issues
  - [x] 5.5 Update CLAUDE.md with new local-first workflows
  - [x] 5.6 Verify documentation completeness and accuracy