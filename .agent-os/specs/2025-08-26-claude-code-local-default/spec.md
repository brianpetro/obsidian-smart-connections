# Spec Requirements Document

> Spec: Claude Code CLI Local Default
> Created: 2025-08-26

## Overview

Transform Smart Connections to operate completely locally using Claude Code CLI as the default AI provider, eliminating the need for any API keys or external services. This ensures complete privacy, no usage costs, and immediate out-of-the-box functionality for all users.

## User Stories

### Zero-Configuration Local AI Chat

As a **new Obsidian user**, I want to install Smart Connections and immediately start chatting with an AI about my notes, so that I don't need to sign up for any services or configure API keys.

When I install the Smart Connections plugin and open Smart Chat for the first time, it should immediately work using Claude Code CLI locally on my machine. I should be able to ask questions about my vault content, get intelligent responses, and never see any API key configuration screens. The entire experience should be private, with all processing happening on my local machine.

### Privacy-First Vault Intelligence  

As a **privacy-conscious user**, I want all my note interactions to remain completely local, so that my personal and professional information never leaves my machine.

I should be able to use Smart Chat with confidence that my vault content, questions, and AI responses are processed entirely locally through Claude Code CLI. The plugin should clearly indicate that it's using local processing, and I should never be prompted for or required to enter external API credentials.

### Seamless Migration Experience

As an **existing user with API configuration**, I want to easily switch to local processing without losing my chat history, so that I can benefit from privacy and cost savings.

The plugin should detect my existing OpenAI or Anthropic configuration and offer a one-click migration to Claude Code CLI. All my existing chat threads, preferences, and settings should be preserved. The migration should clearly explain the benefits of local processing and guide me through any necessary setup.

## Spec Scope

1. **Default Configuration Update** - Set Claude Code CLI as the primary default adapter across all configuration layers
2. **UI Simplification** - Hide API key configuration UI when Claude Code CLI is active, show only local settings
3. **Thread Defaults Alignment** - Update base SmartThreads class to use Claude Code CLI instead of OpenAI defaults
4. **Settings Migration** - Auto-migrate existing users from API-based providers to Claude Code CLI when appropriate
5. **First-Run Experience** - Ensure Claude Code CLI validation and setup happens automatically on first launch

## Out of Scope

- Removing other AI provider adapters (they remain as options for advanced users)
- Changing the existing Claude Code CLI adapter implementation
- Modifying the core Smart Connections (semantic search) functionality
- Changing how embeddings are generated or stored
- Altering the plugin's core architecture or data structures

## Expected Deliverable

1. Smart Chat works immediately after plugin installation without any API configuration
2. Settings UI shows Claude Code CLI as the active provider with local-only options
3. All configuration layers consistently default to Claude Code CLI