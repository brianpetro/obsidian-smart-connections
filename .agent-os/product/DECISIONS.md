# Architecture Decision Records

## Decision 1: Local Claude Code Integration

**Date**: 2025-08-26  
**Status**: Approved  
**Decision**: Replace all external AI providers with local Claude Code processing

### Context
Smart Connections currently supports multiple AI providers (OpenAI, Anthropic, Google, Ollama, etc.) through adapter pattern. The goal is to create a personal AI second brain that prioritizes privacy and local processing.

### Decision
Integrate directly with Claude Code CLI for all AI functionality, removing dependency on external APIs and provider adapters.

### Rationale
- **Privacy**: All processing happens locally, no data leaves machine
- **Reliability**: No internet dependency or API limits
- **Cost**: No ongoing API costs for usage
- **Performance**: Optimized for single-user, local execution
- **Simplicity**: Single AI provider reduces complexity
- **Control**: Full control over AI behavior and capabilities

### Consequences
- **Positive**: Enhanced privacy, offline operation, no API costs
- **Negative**: Dependency on Claude Code availability and performance
- **Neutral**: Significant refactoring required for chat system

---

## Decision 2: JSBrains Ecosystem Simplification

**Date**: 2025-08-26  
**Status**: Approved  
**Decision**: Reduce JSBrains dependencies to essential packages only

### Context
Current architecture uses 15+ JSBrains packages with extensive modular design. For personal use, this creates unnecessary complexity and maintenance overhead.

### Decision
Keep only essential packages:
- `smart-collections` - Data storage
- `smart-file-system` - File operations
- `smart-embed-model` - Local embeddings
- `smart-sources` - Content processing
- `smart-view` - UI components
- `obsidian-smart-env` - Core environment

Remove provider-specific packages and consolidate functionality.

### Rationale
- **Maintainability**: Fewer dependencies to manage and update
- **Performance**: Reduced bundle size and memory usage
- **Simplicity**: Easier to understand and modify codebase
- **Focus**: Optimize for personal workflows rather than general use

### Consequences
- **Positive**: Simplified architecture, better performance
- **Negative**: Some existing functionality may need reimplementation
- **Neutral**: Requires careful migration to avoid breaking features

---

## Decision 3: Personal-First Design

**Date**: 2025-08-26  
**Status**: Approved  
**Decision**: Optimize entirely for single-user, personal workflows

### Context
Smart Connections was originally designed as a community plugin supporting multiple users and use cases. The new vision focuses on creating the perfect personal AI second brain.

### Decision
Transform the plugin from general-purpose to personally-optimized:
- Remove multi-user considerations
- Optimize for individual workflow patterns
- Add personal-specific features (meetings, tasks)
- Focus on deep Obsidian integration

### Rationale
- **Optimization**: Better performance when not supporting multiple users
- **Features**: Can add highly specific personal workflow features
- **Maintenance**: Simpler codebase focused on single use case
- **Evolution**: Faster iteration without backward compatibility concerns

### Consequences
- **Positive**: Perfect fit for personal use, rapid development
- **Negative**: Not suitable for community distribution
- **Neutral**: Paradigm shift from general plugin to personal tool

---

## Decision 4: Component-Based UI Architecture

**Date**: Based on existing codebase  
**Status**: Retained  
**Decision**: Continue using unified component rendering system

### Context
Current architecture uses `env.render_component()` for consistent UI rendering across different views and features.

### Decision
Maintain the component-based architecture for UI elements.

### Rationale
- **Consistency**: Uniform rendering across plugin features
- **Reusability**: Components can be shared between views
- **Maintainability**: Centralized UI logic
- **Extensibility**: Easy to add new components for personal workflows

### Consequences
- **Positive**: Clean separation of UI and logic
- **Negative**: Small learning curve for component system
- **Neutral**: Continues existing successful pattern

---

## Decision 5: Local-First Embeddings

**Date**: Based on existing codebase  
**Status**: Retained  
**Decision**: Keep Transformers.js with TaylorAI/bge-micro-v2 for embeddings

### Context
Smart Connections currently uses local embedding generation with Transformers.js, providing zero-setup semantic search.

### Decision
Maintain local embedding generation while integrating Claude Code for chat functionality.

### Rationale
- **Privacy**: Embeddings generated locally without external calls
- **Performance**: Optimized embedding model for note similarity
- **Reliability**: No dependency on external embedding APIs
- **Cost**: No ongoing costs for embedding generation

### Consequences
- **Positive**: Preserves excellent semantic search capabilities
- **Negative**: Additional local processing requirements
- **Neutral**: Hybrid approach with local embeddings + Claude Code chat

---

## Decision 6: Event-Driven Updates

**Date**: Based on existing codebase  
**Status**: Retained  
**Decision**: Continue event-driven architecture for file changes

### Context
Plugin currently responds to file changes, active leaf changes, and settings updates through event system.

### Decision
Maintain event-driven update system for responsive user experience.

### Rationale
- **Responsiveness**: UI updates immediately when vault changes
- **Efficiency**: Only processes changed content, not entire vault
- **User Experience**: Seamless integration with Obsidian workflows

### Consequences
- **Positive**: Excellent user experience and performance
- **Negative**: Slight complexity in event handling
- **Neutral**: Proven pattern that works well

---

## Decision 7: Single Configuration File

**Date**: 2025-08-26  
**Status**: Approved  
**Decision**: Simplify configuration hierarchy for personal use

### Context
Current system merges multiple configuration files from different packages and external sources.

### Decision
Streamline to single configuration approach optimized for personal workflows.

### Rationale
- **Simplicity**: Easier to understand and modify settings
- **Personal Optimization**: Configure exactly for individual needs
- **Maintenance**: Fewer configuration sources to manage

### Consequences
- **Positive**: Simpler configuration management
- **Negative**: May require migration of existing settings
- **Neutral**: Better fit for single-user optimization

---

## Decision 8: Agent OS Integration

**Date**: 2025-08-26  
**Status**: Approved  
**Decision**: Adopt Agent OS for development workflow management

### Context
Need structured approach to manage the transformation from community plugin to personal AI system.

### Decision
Install Agent OS to provide documentation, workflow templates, and development structure.

### Rationale
- **Organization**: Clear documentation of decisions and roadmap
- **Workflow**: Structured approach to feature development
- **Evolution**: Framework for systematic improvements
- **Documentation**: Maintain clear vision and technical decisions

### Consequences
- **Positive**: Better organized development process
- **Negative**: Additional documentation maintenance
- **Neutral**: New workflow approach to learn

---

## Future Decisions

### Pending Decisions
- **Claude Code Communication Method**: How to interface with Claude Code CLI
- **Context Management**: How much vault context to provide to Claude Code
- **Workflow Templates**: Which personal workflows to implement first
- **Migration Strategy**: How to transition existing data and settings

### Decision Process
For future architectural decisions:
1. Document context and options
2. Consider impact on personal optimization goals
3. Evaluate against privacy and local-first principles
4. Record decision and rationale
5. Monitor consequences and adjust if needed

---

*These decisions guide the evolution of Smart Connections into a personal AI second brain optimized for local Claude Code integration and individual workflow excellence.*