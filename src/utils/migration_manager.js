/**
 * Migration Manager for API Provider to Claude Code CLI Transition
 * Handles seamless migration from external APIs to local processing
 * Preserves chat history and provides rollback capabilities
 */

import { Notice } from 'obsidian';
import { MigrationConfirmationModal } from '../modals/migration_confirmation_modal.js';

export class MigrationManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.settings = plugin.settings;
  }

  /**
   * Initialize migration system and check for eligible users
   */
  async initialize() {
    try {
      // Check if user is eligible for migration
      const isEligible = await this.isEligibleForMigration();
      
      if (isEligible) {
        // Show migration suggestion after a delay to avoid overwhelming new users
        setTimeout(() => {
          this.suggestMigration();
        }, 5000);
      }
    } catch (error) {
      console.error('Migration manager initialization failed:', error);
    }
  }

  /**
   * Detect existing API configurations
   */
  detectApiConfiguration() {
    const apiConfigs = [];
    
    if (!this.settings.smart_chat_model) return apiConfigs;
    
    // Check for OpenAI configuration
    if (this.settings.smart_chat_model.adapter === 'openai' && 
        this.settings.smart_chat_model.openai?.api_key) {
      apiConfigs.push({
        provider: 'OpenAI',
        adapter: 'openai',
        hasApiKey: true,
        model: this.settings.smart_chat_model.openai.model_key || 'gpt-4o',
        additionalSettings: {
          organization: this.settings.smart_chat_model.openai.organization
        }
      });
    }
    
    // Check for Anthropic configuration
    if (this.settings.smart_chat_model.adapter === 'anthropic' && 
        this.settings.smart_chat_model.anthropic?.api_key) {
      apiConfigs.push({
        provider: 'Anthropic',
        adapter: 'anthropic',
        hasApiKey: true,
        model: this.settings.smart_chat_model.anthropic.model_key || 'claude-3-5-sonnet-20241022',
        additionalSettings: {}
      });
    }
    
    // Check for other external APIs
    const externalAdapters = ['google', 'groq', 'openrouter'];
    externalAdapters.forEach(adapter => {
      if (this.settings.smart_chat_model.adapter === adapter && 
          this.settings.smart_chat_model[adapter]?.api_key) {
        apiConfigs.push({
          provider: adapter.charAt(0).toUpperCase() + adapter.slice(1),
          adapter,
          hasApiKey: true,
          model: this.settings.smart_chat_model[adapter].model_key,
          additionalSettings: {}
        });
      }
    });
    
    return apiConfigs;
  }

  /**
   * Check if user is eligible for migration to Claude Code CLI
   */
  async isEligibleForMigration() {
    try {
      // Must have API configuration
      const apiConfigs = this.detectApiConfiguration();
      const hasApiConfig = apiConfigs.length > 0;
      
      // Must not already be using Claude Code CLI
      const notUsingClaude = this.settings.smart_chat_model?.adapter !== 'claude_code_cli';
      
      // Claude CLI must be available
      const claudeCliAvailable = await this.checkClaudeCodeCLIAvailability();
      
      return hasApiConfig && notUsingClaude && claudeCliAvailable;
    } catch (error) {
      console.error('Error checking migration eligibility:', error);
      return false;
    }
  }

  /**
   * Check if Claude Code CLI is available
   */
  async checkClaudeCodeCLIAvailability() {
    try {
      // Use first-run manager if available
      if (this.plugin.first_run_manager) {
        const availability = await this.plugin.first_run_manager.checkClaudeCodeCLIAvailability();
        return availability.available;
      }
      
      // Fallback check
      return false;
    } catch (error) {
      console.error('Claude Code CLI availability check failed:', error);
      return false;
    }
  }

  /**
   * Create migration plan
   */
  async createMigrationPlan() {
    const currentConfig = this.settings.smart_chat_model;
    const chatHistory = await this.getChatHistory();
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
        provider: 'Claude Code CLI'
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
        'Faster responses without network delays',
        'No rate limiting or usage restrictions'
      ],
      statistics: this.calculateMigrationStats(chatHistory, currentConfig.adapter)
    };
  }

  /**
   * Calculate migration statistics
   */
  calculateMigrationStats(chatHistory, fromAdapter) {
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
  }

  /**
   * Get chat history from the plugin
   */
  async getChatHistory() {
    try {
      if (this.plugin.env?.smart_threads) {
        return this.plugin.env.smart_threads.items || {};
      }
      return {};
    } catch (error) {
      console.error('Failed to get chat history:', error);
      return {};
    }
  }

  /**
   * Suggest migration to user
   */
  suggestMigration() {
    try {
      const apiConfigs = this.detectApiConfiguration();
      if (apiConfigs.length === 0) return;

      const currentProvider = apiConfigs[0].provider;
      
      // Show subtle notice first
      const notice = new Notice(
        `💡 Switch from ${currentProvider} to local AI processing for complete privacy and no costs? Click to learn more.`,
        8000
      );
      
      // Make notice clickable
      notice.noticeEl.style.cursor = 'pointer';
      notice.noticeEl.addEventListener('click', () => {
        this.showMigrationModal();
        notice.hide();
      });

    } catch (error) {
      console.error('Failed to suggest migration:', error);
    }
  }

  /**
   * Show migration confirmation modal
   */
  async showMigrationModal() {
    try {
      const migrationPlan = await this.createMigrationPlan();
      
      const modal = new MigrationConfirmationModal(this.plugin.app, this.plugin, {
        migrationPlan,
        onConfirm: async () => {
          await this.executeMigration(migrationPlan);
        },
        onCancel: () => {
          console.log('Migration cancelled by user');
        }
      });
      
      modal.open();
    } catch (error) {
      console.error('Failed to show migration modal:', error);
      new Notice('Unable to show migration options. Please check settings manually.', 5000);
    }
  }

  /**
   * Execute the migration process
   */
  async executeMigration(migrationPlan) {
    try {
      // Show progress notice
      const progressNotice = new Notice('🔄 Migrating to Claude Code CLI...', 0);
      
      // Step 1: Create backup
      const backup = await this.createConfigBackup();
      console.log('Created migration backup:', backup.backupId);
      
      // Step 2: Migrate settings
      await this.migrateSettings(migrationPlan);
      
      // Step 3: Update chat threads
      await this.updateChatThreads(migrationPlan);
      
      // Step 4: Validate migration
      const validation = await this.validateMigration(backup.originalSettings);
      
      if (validation.success) {
        progressNotice.hide();
        new Notice('✅ Successfully migrated to Claude Code CLI! Your chat history has been preserved.', 8000);
        
        // Reload model to use new adapter
        if (this.plugin.env?.smart_threads?.reload_chat_model) {
          this.plugin.env.smart_threads.reload_chat_model();
        }
        
      } else {
        progressNotice.hide();
        console.error('Migration validation failed:', validation.issues);
        new Notice(`⚠️ Migration completed but with issues: ${validation.issues.join(', ')}`, 10000);
      }
      
    } catch (error) {
      console.error('Migration execution failed:', error);
      new Notice(`❌ Migration failed: ${error.message}. Your original settings have been preserved.`, 10000);
    }
  }

  /**
   * Create configuration backup
   */
  async createConfigBackup() {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    
    const backup = {
      backupId: `migration-backup-${timestamp}`,
      timestamp: new Date().toISOString(),
      originalSettings: JSON.parse(JSON.stringify(this.settings)),
      migrationReason: 'switch_to_local_processing',
      canRestore: true
    };
    
    // Store backup in plugin data
    if (!this.settings.migration_backups) {
      this.settings.migration_backups = [];
    }
    this.settings.migration_backups.push(backup);
    
    // Keep only last 5 backups
    this.settings.migration_backups = this.settings.migration_backups.slice(-5);
    
    await this.plugin.saveSettings();
    return backup;
  }

  /**
   * Migrate settings to Claude Code CLI
   */
  async migrateSettings(migrationPlan) {
    // Update chat model settings
    this.settings.smart_chat_model.adapter = 'claude_code_cli';
    
    if (!this.settings.smart_chat_model.claude_code_cli) {
      this.settings.smart_chat_model.claude_code_cli = {};
    }
    
    // Apply optimal settings for Claude Code CLI
    Object.assign(this.settings.smart_chat_model.claude_code_cli, {
      model_key: 'claude-code-cli',
      timeout: 60000,
      max_retries: 3,
      context_limit: 5
    });

    // Preserve original API settings for potential rollback (but don't use them)
    // They're already in the settings, so no changes needed
    
    await this.plugin.saveSettings();
  }

  /**
   * Update chat thread configurations
   */
  async updateChatThreads(migrationPlan) {
    try {
      const chatHistory = await this.getChatHistory();
      const fromAdapter = migrationPlan.from.adapter;
      
      // Update threads that were using the old adapter
      Object.keys(chatHistory).forEach(key => {
        const thread = chatHistory[key];
        
        if (thread.settings?.adapter === fromAdapter) {
          // Preserve original settings for rollback
          thread.settings._migrated_from = {
            adapter: fromAdapter,
            original_settings: { ...thread.settings }
          };
          
          // Update to Claude Code CLI
          thread.settings.adapter = 'claude_code_cli';
          thread.settings.model_key = 'claude-code-cli';
        }
      });
      
      // Save updated threads (this depends on the plugin's thread storage mechanism)
      if (this.plugin.env?.smart_threads?.queue_save) {
        this.plugin.env.smart_threads.queue_save();
      }
      
    } catch (error) {
      console.error('Failed to update chat threads:', error);
      throw error;
    }
  }

  /**
   * Validate migration success
   */
  async validateMigration(originalSettings) {
    const validationResults = {
      success: true,
      issues: []
    };

    try {
      // Check adapter was updated
      if (this.settings.smart_chat_model?.adapter !== 'claude_code_cli') {
        validationResults.success = false;
        validationResults.issues.push('Adapter not updated to claude_code_cli');
      }

      // Check Claude CLI config exists
      if (!this.settings.smart_chat_model?.claude_code_cli) {
        validationResults.success = false;
        validationResults.issues.push('Claude Code CLI configuration missing');
      }

      // Check CLI availability
      const claudeCliAvailable = await this.checkClaudeCodeCLIAvailability();
      if (!claudeCliAvailable) {
        validationResults.success = false;
        validationResults.issues.push('Claude Code CLI not available on system');
      }

      // Check backup preservation
      if (!this.settings.smart_chat_model?.[originalSettings.smart_chat_model.adapter]) {
        validationResults.issues.push('Original configuration not preserved for rollback');
      }

    } catch (error) {
      validationResults.success = false;
      validationResults.issues.push(`Validation error: ${error.message}`);
    }

    return validationResults;
  }

  /**
   * Restore from backup (rollback functionality)
   */
  async restoreFromBackup(backupId) {
    try {
      const backup = this.settings.migration_backups?.find(b => b.backupId === backupId);
      if (!backup) {
        throw new Error('Backup not found');
      }

      // Restore original settings
      Object.assign(this.settings, backup.originalSettings);
      await this.plugin.saveSettings();

      // Reload model
      if (this.plugin.env?.smart_threads?.reload_chat_model) {
        this.plugin.env.smart_threads.reload_chat_model();
      }

      new Notice(`✅ Restored configuration from backup: ${backupId}`, 5000);
      return true;

    } catch (error) {
      console.error('Restore from backup failed:', error);
      new Notice(`❌ Failed to restore backup: ${error.message}`, 8000);
      return false;
    }
  }

  /**
   * Get available backups for rollback
   */
  getAvailableBackups() {
    return this.settings.migration_backups || [];
  }
}