import test from 'ava';

/**
 * Test migration functionality for existing API users to Claude Code CLI
 * Ensures smooth transition while preserving chat history and user preferences
 */

// Mock settings structures
const createMockSettings = (adapter = 'openai', hasApiKey = true) => ({
  smart_chat_model: {
    adapter,
    [adapter]: {
      ...(adapter === 'openai' && {
        api_key: hasApiKey ? 'sk-test-key-123' : '',
        model_key: 'gpt-4o',
        organization: 'org-123'
      }),
      ...(adapter === 'anthropic' && {
        api_key: hasApiKey ? 'sk-ant-test-key-123' : '',
        model_key: 'claude-3-5-sonnet-20241022'
      }),
      ...(adapter === 'claude_code_cli' && {
        model_key: 'claude-code-cli',
        timeout: 60000,
        max_retries: 3,
        context_limit: 5
      })
    }
  },
  first_run_complete: true
});

// Mock chat history structure
const createMockChatHistory = () => ({
  'thread-1': {
    key: 'thread-1',
    name: 'My First Chat',
    messages: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ],
    settings: {
      adapter: 'openai',
      model_key: 'gpt-4o'
    }
  },
  'thread-2': {
    key: 'thread-2', 
    name: 'Another Chat',
    messages: [
      { role: 'user', content: 'How are you?' },
      { role: 'assistant', content: 'I am doing well!' }
    ],
    settings: {
      adapter: 'anthropic',
      model_key: 'claude-3-5-sonnet-20241022'
    }
  }
});

test('should detect existing OpenAI configuration', t => {
  const detectApiConfiguration = (settings) => {
    const apiConfigs = [];
    
    if (settings.smart_chat_model?.adapter === 'openai' && settings.smart_chat_model.openai?.api_key) {
      apiConfigs.push({
        provider: 'openai',
        adapter: 'openai',
        hasApiKey: !!settings.smart_chat_model.openai.api_key,
        model: settings.smart_chat_model.openai.model_key,
        additionalSettings: {
          organization: settings.smart_chat_model.openai.organization
        }
      });
    }
    
    if (settings.smart_chat_model?.adapter === 'anthropic' && settings.smart_chat_model.anthropic?.api_key) {
      apiConfigs.push({
        provider: 'anthropic',
        adapter: 'anthropic', 
        hasApiKey: !!settings.smart_chat_model.anthropic.api_key,
        model: settings.smart_chat_model.anthropic.model_key,
        additionalSettings: {}
      });
    }
    
    return apiConfigs;
  };

  const openaiSettings = createMockSettings('openai', true);
  const noKeySettings = createMockSettings('openai', false);
  const claudeSettings = createMockSettings('claude_code_cli');

  const openaiConfigs = detectApiConfiguration(openaiSettings);
  const noKeyConfigs = detectApiConfiguration(noKeySettings);
  const claudeConfigs = detectApiConfiguration(claudeSettings);

  t.is(openaiConfigs.length, 1, 'Should detect OpenAI configuration');
  t.is(openaiConfigs[0].provider, 'openai', 'Should identify OpenAI provider');
  t.true(openaiConfigs[0].hasApiKey, 'Should detect API key presence');

  t.is(noKeyConfigs.length, 0, 'Should not detect config without API key');
  t.is(claudeConfigs.length, 0, 'Should not detect Claude Code CLI as API config');
});

test('should detect existing Anthropic configuration', t => {
  const detectApiConfiguration = (settings) => {
    const apiConfigs = [];
    
    if (settings.smart_chat_model?.adapter === 'anthropic' && settings.smart_chat_model.anthropic?.api_key) {
      apiConfigs.push({
        provider: 'anthropic',
        adapter: 'anthropic',
        hasApiKey: !!settings.smart_chat_model.anthropic.api_key,
        model: settings.smart_chat_model.anthropic.model_key
      });
    }
    
    return apiConfigs;
  };

  const anthropicSettings = createMockSettings('anthropic', true);
  const configs = detectApiConfiguration(anthropicSettings);

  t.is(configs.length, 1, 'Should detect Anthropic configuration');
  t.is(configs[0].provider, 'anthropic', 'Should identify Anthropic provider');
  t.is(configs[0].model, 'claude-3-5-sonnet-20241022', 'Should capture model');
});

test('should determine if user is eligible for migration', t => {
  const isEligibleForMigration = (settings, claudeCliAvailable = true) => {
    // Must have API configuration
    const hasApiConfig = (
      (settings.smart_chat_model?.adapter === 'openai' && settings.smart_chat_model.openai?.api_key) ||
      (settings.smart_chat_model?.adapter === 'anthropic' && settings.smart_chat_model.anthropic?.api_key)
    );
    
    // Must not already be using Claude Code CLI
    const notUsingClaude = settings.smart_chat_model?.adapter !== 'claude_code_cli';
    
    // Claude CLI must be available
    return hasApiConfig && notUsingClaude && claudeCliAvailable;
  };

  const openaiSettings = createMockSettings('openai', true);
  const claudeSettings = createMockSettings('claude_code_cli');
  const noKeySettings = createMockSettings('openai', false);

  t.true(isEligibleForMigration(openaiSettings, true), 'Should be eligible with API config and CLI available');
  t.false(isEligibleForMigration(claudeSettings, true), 'Should not be eligible if already using Claude CLI');
  t.false(isEligibleForMigration(noKeySettings, true), 'Should not be eligible without API key');
  t.false(isEligibleForMigration(openaiSettings, false), 'Should not be eligible if CLI unavailable');
});

test('should create migration plan', t => {
  const createMigrationPlan = (currentSettings, chatHistory) => {
    const currentConfig = currentSettings.smart_chat_model;
    const threadsToUpdate = Object.values(chatHistory || {}).filter(thread => 
      thread.settings?.adapter !== 'claude_code_cli'
    );

    return {
      from: {
        adapter: currentConfig.adapter,
        model: currentConfig[currentConfig.adapter]?.model_key,
        provider: currentConfig.adapter
      },
      to: {
        adapter: 'claude_code_cli',
        model: 'claude-code-cli',
        provider: 'claude_code_cli'
      },
      changes: {
        settingsUpdate: true,
        threadsToUpdate: threadsToUpdate.length,
        threadKeys: threadsToUpdate.map(t => t.key),
        preserveHistory: true,
        backupRequired: true
      },
      benefits: [
        'Complete privacy - conversations never leave your machine',
        'No API costs or usage limits',
        'Works offline after setup',
        'Faster responses without network latency'
      ]
    };
  };

  const settings = createMockSettings('openai', true);
  const history = createMockChatHistory();
  const plan = createMigrationPlan(settings, history);

  t.is(plan.from.adapter, 'openai', 'Should capture source adapter');
  t.is(plan.to.adapter, 'claude_code_cli', 'Should target Claude Code CLI');
  t.is(plan.changes.threadsToUpdate, 2, 'Should identify threads to update');
  t.true(plan.changes.preserveHistory, 'Should preserve chat history');
  t.true(Array.isArray(plan.benefits), 'Should include benefits');
  t.true(plan.benefits.length > 0, 'Should have migration benefits');
});

test('should backup existing configuration', t => {
  const createConfigBackup = (settings) => {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    
    return {
      backupId: `migration-backup-${timestamp}`,
      timestamp: new Date().toISOString(),
      originalSettings: JSON.parse(JSON.stringify(settings)),
      migrationReason: 'switch_to_local_processing',
      canRestore: true
    };
  };

  const settings = createMockSettings('openai', true);
  const backup = createConfigBackup(settings);

  t.truthy(backup.backupId, 'Should generate backup ID');
  t.truthy(backup.timestamp, 'Should have timestamp');
  t.truthy(backup.originalSettings, 'Should backup original settings');
  t.is(backup.originalSettings.smart_chat_model.adapter, 'openai', 'Should preserve original adapter');
  t.true(backup.canRestore, 'Should be restorable');
});

test('should migrate settings while preserving non-chat configurations', t => {
  const migrateSettings = (originalSettings) => {
    const migratedSettings = JSON.parse(JSON.stringify(originalSettings));
    
    // Update chat model settings
    migratedSettings.smart_chat_model.adapter = 'claude_code_cli';
    migratedSettings.smart_chat_model.claude_code_cli = {
      model_key: 'claude-code-cli',
      timeout: 60000,
      max_retries: 3,
      context_limit: 5
    };

    // Preserve original API settings for potential rollback (but don't use them)
    // Keep other settings intact
    
    return migratedSettings;
  };

  const originalSettings = {
    ...createMockSettings('openai', true),
    other_feature: 'preserved',
    user_preferences: { theme: 'dark' }
  };

  const migrated = migrateSettings(originalSettings);

  t.is(migrated.smart_chat_model.adapter, 'claude_code_cli', 'Should update adapter');
  t.truthy(migrated.smart_chat_model.claude_code_cli, 'Should add Claude CLI config');
  t.is(migrated.other_feature, 'preserved', 'Should preserve other settings');
  t.truthy(migrated.smart_chat_model.openai, 'Should preserve original API config for rollback');
});

test('should update chat thread configurations', t => {
  const updateChatThreads = (chatHistory, fromAdapter, toAdapter) => {
    const updatedHistory = {};
    
    Object.keys(chatHistory).forEach(key => {
      const thread = { ...chatHistory[key] };
      
      if (thread.settings?.adapter === fromAdapter) {
        thread.settings = {
          ...thread.settings,
          adapter: toAdapter,
          model_key: toAdapter === 'claude_code_cli' ? 'claude-code-cli' : thread.settings.model_key,
          // Preserve original settings in metadata for rollback
          _migrated_from: {
            adapter: fromAdapter,
            original_settings: { ...thread.settings }
          }
        };
      }
      
      updatedHistory[key] = thread;
    });
    
    return updatedHistory;
  };

  const history = createMockChatHistory();
  const updated = updateChatThreads(history, 'openai', 'claude_code_cli');

  const thread1 = updated['thread-1'];
  const thread2 = updated['thread-2'];

  t.is(thread1.settings.adapter, 'claude_code_cli', 'Should update OpenAI thread to Claude CLI');
  t.is(thread1.settings.model_key, 'claude-code-cli', 'Should update model key');
  t.truthy(thread1.settings._migrated_from, 'Should preserve original settings for rollback');
  
  t.is(thread2.settings.adapter, 'anthropic', 'Should not change non-OpenAI threads');
  t.is(thread2.messages.length, 2, 'Should preserve message history');
});

test('should validate migration success', t => {
  const validateMigration = (originalSettings, migratedSettings, claudeCliAvailable = true) => {
    const validationResults = {
      success: true,
      issues: []
    };

    // Check adapter was updated
    if (migratedSettings.smart_chat_model?.adapter !== 'claude_code_cli') {
      validationResults.success = false;
      validationResults.issues.push('Adapter not updated to claude_code_cli');
    }

    // Check Claude CLI config exists
    if (!migratedSettings.smart_chat_model?.claude_code_cli) {
      validationResults.success = false;
      validationResults.issues.push('Claude Code CLI configuration missing');
    }

    // Check CLI availability
    if (!claudeCliAvailable) {
      validationResults.success = false;
      validationResults.issues.push('Claude Code CLI not available on system');
    }

    // Check backup preservation
    if (!migratedSettings.smart_chat_model?.[originalSettings.smart_chat_model.adapter]) {
      validationResults.issues.push('Original configuration not preserved for rollback');
    }

    return validationResults;
  };

  const original = createMockSettings('openai', true);
  const goodMigration = createMockSettings('claude_code_cli');
  goodMigration.smart_chat_model.openai = original.smart_chat_model.openai; // Preserve for rollback

  const incompleteMigration = createMockSettings('openai', true);

  const goodResult = validateMigration(original, goodMigration, true);
  const incompleteResult = validateMigration(original, incompleteMigration, true);
  const unavailableResult = validateMigration(original, goodMigration, false);

  t.true(goodResult.success, 'Should validate successful migration');
  t.is(goodResult.issues.length, 0, 'Should have no issues for complete migration');

  t.false(incompleteResult.success, 'Should fail incomplete migration');
  t.true(incompleteResult.issues.length > 0, 'Should report migration issues');

  t.false(unavailableResult.success, 'Should fail if CLI unavailable');
});

test('should calculate migration statistics', t => {
  const calculateMigrationStats = (chatHistory, fromAdapter) => {
    const threads = Object.values(chatHistory || {});
    const threadsToMigrate = threads.filter(t => t.settings?.adapter === fromAdapter);
    const totalMessages = threadsToMigrate.reduce((sum, t) => sum + (t.messages?.length || 0), 0);
    
    return {
      totalThreads: threads.length,
      threadsToMigrate: threadsToMigrate.length,
      threadsToPreserve: threads.length - threadsToMigrate.length,
      totalMessages,
      estimatedTime: Math.max(2, Math.ceil(threadsToMigrate.length / 10)) // seconds
    };
  };

  const history = createMockChatHistory();
  const stats = calculateMigrationStats(history, 'openai');

  t.is(stats.totalThreads, 2, 'Should count total threads');
  t.is(stats.threadsToMigrate, 1, 'Should count threads to migrate');
  t.is(stats.threadsToPreserve, 1, 'Should count threads to preserve');
  t.is(stats.totalMessages, 2, 'Should count total messages in threads to migrate');
  t.truthy(stats.estimatedTime, 'Should estimate migration time');
});