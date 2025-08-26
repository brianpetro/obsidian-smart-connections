# Configuration Examples for Different Use Cases

> **Ready-to-use configurations optimized for specific scenarios**

## Table of Contents

1. [Personal Knowledge Base](#personal-knowledge-base)
2. [Academic Research Vault](#academic-research-vault)
3. [Software Development Vault](#software-development-vault)
4. [Creative Writing Vault](#creative-writing-vault)
5. [Business & Project Management](#business--project-management)
6. [Large Vault Optimization](#large-vault-optimization)
7. [Minimal Resource Usage](#minimal-resource-usage)
8. [Maximum Privacy Configuration](#maximum-privacy-configuration)

## Personal Knowledge Base

### Use Case
- Personal notes, journal entries, learning notes
- 100-500 notes typical
- Mixed content types
- Privacy important

### Configuration

```javascript
// Smart Connections Settings
{
  "smart_chat": {
    "model": "claude-code-cli",
    "max_tokens": 200000,
    "temperature": 0.7,
    "context_limit": 2000,
    "max_context_sources": 7,
    "include_system_prompt": true
  },
  
  "smart_connections": {
    "embedding_model": "TaylorAI/bge-micro-v2",
    "min_embedding_length": 200,
    "max_embedding_length": 5000,
    "display_count": 20,
    "show_full_path": false,
    "show_blocks": true
  },
  
  "smart_environment": {
    "excluded_folders": [
      "Templates/",
      "Archive/",
      ".obsidian/",
      ".trash/"
    ],
    "excluded_files": [
      "*.pdf",
      "*.png",
      "*.jpg",
      "private-*"
    ],
    "batch_size": 10,
    "debounce_delay": 2000
  }
}
```

### Why These Settings Work

```markdown
- **Temperature 0.7**: Good balance for creative and factual responses
- **7 context sources**: Enough context without overwhelming
- **Show blocks**: Helpful for finding specific passages
- **Exclude Templates**: Prevents template pollution in results
- **200 char minimum**: Filters out very short notes
```

## Academic Research Vault

### Use Case
- Research papers, citations, thesis work
- 500-2000 notes
- PDFs and long-form content
- Accuracy critical

### Configuration

```javascript
{
  "smart_chat": {
    "model": "claude-code-cli",
    "max_tokens": 200000,
    "temperature": 0.3,  // Lower for accuracy
    "context_limit": 3000,  // More context for complex topics
    "max_context_sources": 10,  // More sources for research
    "include_citations": true,
    "include_system_prompt": true,
    "system_prompt": "You are an academic research assistant. Always cite sources and maintain academic rigor."
  },
  
  "smart_connections": {
    "embedding_model": "TaylorAI/bge-micro-v2",
    "min_embedding_length": 500,  // Skip short notes
    "max_embedding_length": 10000,  // Handle long papers
    "display_count": 30,  // Show more results
    "show_full_path": true,  // See folder structure
    "show_blocks": true,
    "similarity_threshold": 0.65  // Higher threshold for relevance
  },
  
  "smart_environment": {
    "excluded_folders": [
      ".obsidian/",
      "Templates/",
      "Archive/"
    ],
    "excluded_files": [
      "*.png",
      "*.jpg",
      "daily-note-*"
    ],
    "pdf_processing": true,  // Enable PDF content extraction
    "batch_size": 5,  // Smaller batches for large files
    "debounce_delay": 3000,
    "chunk_size": 1500,  // Larger chunks for context
    "chunk_overlap": 200
  }
}
```

### Research-Specific Features

```javascript
// Additional research tools configuration
{
  "research_features": {
    "citation_format": "APA",
    "extract_references": true,
    "bibliography_folder": "References/",
    "auto_link_citations": true,
    "highlight_quotes": true
  }
}
```

## Software Development Vault

### Use Case
- Code documentation, project notes, debugging logs
- 1000-3000 notes
- Code snippets and technical documentation
- Fast iteration needed

### Configuration

```javascript
{
  "smart_chat": {
    "model": "claude-code-cli",
    "max_tokens": 200000,
    "temperature": 0.4,  // More deterministic for code
    "context_limit": 2500,
    "max_context_sources": 8,
    "include_system_prompt": true,
    "system_prompt": "You are a senior software developer assistant. Provide code examples in the user's preferred style based on their vault content."
  },
  
  "smart_connections": {
    "embedding_model": "TaylorAI/bge-micro-v2",
    "min_embedding_length": 100,  // Include short code snippets
    "max_embedding_length": 8000,
    "display_count": 25,
    "show_full_path": true,  // Important for project structure
    "show_blocks": true,
    "similarity_threshold": 0.6,
    "code_block_processing": true  // Special handling for code
  },
  
  "smart_environment": {
    "excluded_folders": [
      ".obsidian/",
      "node_modules/",
      ".git/",
      "dist/",
      "build/",
      ".env/",
      "vendor/"
    ],
    "excluded_files": [
      "*.log",
      "*.lock",
      "*.min.js",
      "*.map",
      ".env*",
      "package-lock.json"
    ],
    "batch_size": 15,
    "debounce_delay": 1500,  // Faster updates for active development
    "process_code_blocks": true,
    "language_specific": {
      "javascript": {
        "include_comments": false,
        "min_block_size": 50
      },
      "python": {
        "include_docstrings": true,
        "min_block_size": 30
      }
    }
  }
}
```

### Code-Specific Optimizations

```javascript
// Developer productivity settings
{
  "developer_features": {
    "auto_link_issues": true,  // Link to issue tracker
    "syntax_highlighting": true,
    "git_integration": true,
    "snippet_extraction": true,
    "error_log_parsing": true,
    "stack_trace_analysis": true
  }
}
```

## Creative Writing Vault

### Use Case
- Fiction, poetry, creative projects
- 500-1500 notes
- Character notes, world-building, drafts
- Creativity and inspiration focus

### Configuration

```javascript
{
  "smart_chat": {
    "model": "claude-code-cli",
    "max_tokens": 200000,
    "temperature": 0.9,  // High creativity
    "context_limit": 2000,
    "max_context_sources": 5,
    "include_system_prompt": true,
    "system_prompt": "You are a creative writing assistant. Help with storytelling, character development, and maintaining narrative consistency."
  },
  
  "smart_connections": {
    "embedding_model": "TaylorAI/bge-micro-v2",
    "min_embedding_length": 100,
    "max_embedding_length": 5000,
    "display_count": 15,
    "show_full_path": false,  // Cleaner display
    "show_blocks": true,
    "similarity_threshold": 0.5  // Broader connections for inspiration
  },
  
  "smart_environment": {
    "excluded_folders": [
      ".obsidian/",
      "Archive/",
      "Trash/",
      "Private/"
    ],
    "excluded_files": [
      "*.pdf",
      "outline-draft-*",
      "backup-*"
    ],
    "batch_size": 10,
    "debounce_delay": 2500,
    "creative_mode": {
      "enable_metaphor_matching": true,
      "theme_extraction": true,
      "character_tracking": true,
      "plot_analysis": true
    }
  }
}
```

### Creative Writing Features

```javascript
{
  "writing_tools": {
    "character_sheets_folder": "Characters/",
    "world_building_folder": "World/",
    "track_word_count": true,
    "scene_linking": true,
    "timeline_tracking": true,
    "style_consistency": true
  }
}
```

## Business & Project Management

### Use Case
- Meeting notes, project documentation, client work
- 1000-2000 notes
- Time-sensitive information
- Collaboration important

### Configuration

```javascript
{
  "smart_chat": {
    "model": "claude-code-cli",
    "max_tokens": 200000,
    "temperature": 0.5,  // Balanced
    "context_limit": 2000,
    "max_context_sources": 8,
    "include_system_prompt": true,
    "system_prompt": "You are a business analyst assistant. Focus on actionable insights, deadlines, and project status."
  },
  
  "smart_connections": {
    "embedding_model": "TaylorAI/bge-micro-v2",
    "min_embedding_length": 150,
    "max_embedding_length": 6000,
    "display_count": 20,
    "show_full_path": true,  // See project structure
    "show_blocks": false,  // Focus on document level
    "similarity_threshold": 0.6,
    "date_aware": true  // Prioritize recent notes
  },
  
  "smart_environment": {
    "excluded_folders": [
      ".obsidian/",
      "Archive/",
      "Personal/",
      "Templates/"
    ],
    "excluded_files": [
      "*.pdf",
      "draft-*",
      "personal-*"
    ],
    "batch_size": 12,
    "debounce_delay": 2000,
    "business_features": {
      "meeting_detection": true,
      "action_item_extraction": true,
      "deadline_tracking": true,
      "stakeholder_mapping": true
    }
  }
}
```

## Large Vault Optimization

### Use Case
- 5000+ notes
- Performance critical
- Mixed content types
- Resource constraints

### Configuration

```javascript
{
  "smart_chat": {
    "model": "claude-code-cli",
    "max_tokens": 100000,  // Reduced
    "temperature": 0.5,
    "context_limit": 1000,  // Smaller context
    "max_context_sources": 3,  // Fewer sources
    "include_system_prompt": false,  // Save tokens
    "streaming": true  // Better perceived performance
  },
  
  "smart_connections": {
    "embedding_model": "TaylorAI/bge-micro-v2",
    "min_embedding_length": 500,  // Skip small notes
    "max_embedding_length": 3000,  // Cap large notes
    "display_count": 10,  // Fewer results
    "show_full_path": false,
    "show_blocks": false,  // Reduce processing
    "similarity_threshold": 0.75,  // Only high matches
    "cache_duration": 3600,  // 1-hour cache
    "lazy_loading": true
  },
  
  "smart_environment": {
    "excluded_folders": [
      ".obsidian/",
      "Archive/",
      "Backup/",
      "Old/",
      "Attachments/",
      "Daily Notes/2022/",  // Old years
      "Daily Notes/2023/"
    ],
    "excluded_files": [
      "*.pdf",
      "*.png",
      "*.jpg",
      "*.mp4",
      "*.zip",
      "daily-note-*",
      "backup-*"
    ],
    "batch_size": 3,  // Small batches
    "debounce_delay": 5000,  // Longer delay
    "max_concurrent": 1,  // Single threading
    "incremental_indexing": true,
    "compression": true,
    "memory_limit": "1GB"
  }
}
```

### Performance Monitoring

```javascript
// Add performance monitoring
{
  "monitoring": {
    "log_performance": true,
    "alert_threshold": {
      "embedding_time": 5000,  // Alert if >5s
      "search_time": 1000,  // Alert if >1s
      "memory_usage": "800MB"
    },
    "auto_optimize": true
  }
}
```

## Minimal Resource Usage

### Use Case
- Older computers
- Limited RAM (4GB or less)
- Slow processors
- Basic functionality needed

### Configuration

```javascript
{
  "smart_chat": {
    "model": "claude-code-cli",
    "max_tokens": 50000,  // Minimal
    "temperature": 0.5,
    "context_limit": 500,  // Very small
    "max_context_sources": 2,  // Minimum
    "include_system_prompt": false,
    "streaming": true
  },
  
  "smart_connections": {
    "embedding_model": "TaylorAI/bge-micro-v2",
    "min_embedding_length": 1000,  // Only substantial notes
    "max_embedding_length": 2000,  // Small chunks
    "display_count": 5,  // Minimal results
    "show_full_path": false,
    "show_blocks": false,
    "similarity_threshold": 0.8,  // Only best matches
    "disable_auto_refresh": true  // Manual refresh only
  },
  
  "smart_environment": {
    "excluded_folders": [
      "**/Archive/",
      "**/Backup/",
      "**/Old/",
      "**/*.assets/",
      "**/node_modules/",
      "**/.git/"
    ],
    "excluded_files": [
      "*"  // Process only .md files
    ],
    "include_files": [
      "*.md"
    ],
    "batch_size": 1,  // One at a time
    "debounce_delay": 10000,  // 10 seconds
    "disable_background": true,
    "minimal_mode": true
  }
}
```

## Maximum Privacy Configuration

### Use Case
- Sensitive information
- Corporate/legal requirements
- Complete offline usage
- No external dependencies

### Configuration

```javascript
{
  "smart_chat": {
    "model": "claude-code-cli",  // Local only
    "disable_external_models": true,
    "max_tokens": 200000,
    "temperature": 0.5,
    "context_limit": 2000,
    "max_context_sources": 5,
    "no_telemetry": true,
    "no_error_reporting": true,
    "local_storage_only": true
  },
  
  "smart_connections": {
    "embedding_model": "TaylorAI/bge-micro-v2",  // Local model
    "disable_cloud_models": true,
    "min_embedding_length": 300,
    "max_embedding_length": 5000,
    "display_count": 15,
    "show_full_path": false,
    "show_blocks": true,
    "local_embeddings_only": true,
    "no_external_apis": true
  },
  
  "smart_environment": {
    "excluded_folders": [
      "Private/",
      "Confidential/",
      "Personal/",
      ".obsidian/",
      "Sensitive/"
    ],
    "excluded_files": [
      "*-private.*",
      "*-confidential.*",
      "password*",
      "*.key",
      "*.pem",
      "*.env"
    ],
    "batch_size": 10,
    "debounce_delay": 2000,
    "privacy_mode": {
      "enabled": true,
      "no_network": true,
      "no_external_storage": true,
      "encrypt_cache": true,
      "secure_delete": true,
      "audit_logging": true
    }
  }
}
```

### Privacy Verification

```javascript
// Verify privacy settings
{
  "privacy_checks": {
    "verify_no_network": true,
    "verify_local_storage": true,
    "verify_no_telemetry": true,
    "log_all_operations": true,
    "alert_on_external_attempt": true
  }
}
```

## Configuration Tips

### How to Apply These Configurations

1. **Open Settings**: Obsidian → Settings → Smart Connections
2. **Navigate to Section**: Find the relevant setting category
3. **Apply Values**: Copy values from examples above
4. **Save & Restart**: Some settings require Obsidian restart

### Testing Your Configuration

```javascript
// Test configuration effectiveness
async function testConfig() {
  // Test embedding speed
  console.time('embedding');
  await generateEmbeddings(testNote);
  console.timeEnd('embedding');
  
  // Test search performance
  console.time('search');
  await searchSimilar('test query');
  console.timeEnd('search');
  
  // Check memory usage
  console.log('Memory:', performance.memory.usedJSHeapSize);
}
```

### Configuration Validation

```markdown
After applying configuration:
1. Check embedding generation: Should complete within expected time
2. Test chat response: Should include appropriate context
3. Verify exclusions: Excluded folders shouldn't appear in results
4. Monitor performance: Check memory and CPU usage
5. Validate privacy: Ensure no external connections
```

### Common Configuration Mistakes

```javascript
// ❌ Wrong: Conflicting settings
{
  "max_context_sources": 10,  // High
  "context_limit": 500        // But limit too low
}

// ✅ Correct: Balanced settings
{
  "max_context_sources": 10,
  "context_limit": 2000       // Enough room for 10 sources
}

// ❌ Wrong: Too aggressive exclusion
{
  "excluded_files": ["*"],    // Excludes everything!
  "include_files": ["*.md"]   // Won't override
}

// ✅ Correct: Specific exclusions
{
  "excluded_files": ["*.pdf", "*.png", "*.jpg"]
}
```

---

[← Back to Documentation](../README.md) | [← Common Workflows](./common-workflows.md) | [User Guide](../user-guide.md)