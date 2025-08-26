/**
 * First Run Experience Manager
 * Handles Claude Code CLI setup and initialization for new users
 * Provides smooth onboarding with helpful guidance and error handling
 */

import { Platform, Notice } from 'obsidian';
import { ClaudeCliSetupModal } from '../modals/claude_cli_setup_modal.js';

export class FirstRunManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.settings = plugin.settings;
  }

  /**
   * Initialize first-run experience on plugin load
   */
  async initialize() {
    try {
      // Check if this is a first-run user
      if (this.isFirstRun()) {
        console.log('First-run detected, initializing setup experience...');
        await this.handleFirstRun();
      } else {
        // For existing users, still check Claude Code CLI availability
        await this.validateClaudeCodeCLISetup();
      }
    } catch (error) {
      console.error('First-run manager initialization failed:', error);
    }
  }

  /**
   * Check if this is the user's first time using the plugin
   */
  isFirstRun() {
    return !this.settings.first_run_complete;
  }

  /**
   * Handle first-run experience
   */
  async handleFirstRun() {
    try {
      // Check Claude Code CLI availability
      const availability = await this.checkClaudeCodeCLIAvailability();
      
      // Generate setup steps based on availability
      const setupSteps = this.generateSetupSteps(availability);
      
      // Auto-configure optimal settings
      await this.applyOptimalSettings();
      
      // Show setup modal if CLI is not available
      if (!availability.available) {
        this.showSetupModal(availability, setupSteps);
      } else {
        // Test connection and mark as complete
        const testResult = await this.testConnection();
        if (testResult.success) {
          await this.markFirstRunComplete();
          this.showSuccessMessage();
        } else {
          this.showSetupModal(availability, setupSteps);
        }
      }
    } catch (error) {
      console.error('First-run handling failed:', error);
      this.showErrorGuide(error);
    }
  }

  /**
   * Check Claude Code CLI availability
   */
  async checkClaudeCodeCLIAvailability() {
    try {
      // Try to get the adapter to test CLI availability
      const adapter = this.getClaudeCodeCLIAdapter();
      if (adapter && typeof adapter.validate_connection === 'function') {
        const isAvailable = await adapter.validate_connection();
        return {
          available: isAvailable,
          adapter: adapter,
          error: isAvailable ? null : 'Claude Code CLI validation failed'
        };
      } else {
        // If adapter doesn't have validation, assume unavailable
        return {
          available: false,
          adapter: null,
          error: 'Claude Code CLI adapter not properly initialized'
        };
      }
    } catch (error) {
      return {
        available: false,
        adapter: null,
        error: error.message
      };
    }
  }

  /**
   * Get Claude Code CLI adapter instance
   */
  getClaudeCodeCLIAdapter() {
    try {
      if (this.plugin.env?.smart_threads?.chat_model?.adapter) {
        const adapter = this.plugin.env.smart_threads.chat_model.adapter;
        if (adapter.constructor.name.includes('ClaudeCode')) {
          return adapter;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get Claude Code CLI adapter:', error);
      return null;
    }
  }

  /**
   * Generate setup steps based on CLI availability
   */
  generateSetupSteps(availability) {
    const steps = [];
    
    if (!availability.available) {
      steps.push({
        id: 'install_claude_cli',
        title: 'Install Claude Code CLI',
        description: 'Required for private, local AI processing',
        required: true,
        completed: false
      });
    }
    
    steps.push({
      id: 'configure_settings',
      title: 'Optimize Settings', 
      description: 'Configure optimal settings for your system',
      required: false,
      completed: false
    });
    
    steps.push({
      id: 'test_connection',
      title: 'Test Connection',
      description: 'Verify everything works correctly',
      required: true,
      completed: false
    });

    return steps;
  }

  /**
   * Apply optimal settings for the user's system
   */
  async applyOptimalSettings() {
    try {
      const optimal = this.generateOptimalSettings();
      
      // Update settings
      if (!this.settings.smart_chat_model) {
        this.settings.smart_chat_model = {};
      }
      
      if (!this.settings.smart_chat_model.claude_code_cli) {
        this.settings.smart_chat_model.claude_code_cli = {};
      }
      
      // Apply optimal settings
      Object.assign(this.settings.smart_chat_model.claude_code_cli, optimal);
      
      // Save settings
      await this.plugin.saveSettings();
      
      console.log('Applied optimal settings:', optimal);
    } catch (error) {
      console.error('Failed to apply optimal settings:', error);
    }
  }

  /**
   * Generate optimal settings based on system capabilities
   */
  generateOptimalSettings() {
    const settings = {
      timeout: 60000, // 60 seconds default
      max_retries: 3,
      context_limit: 5,
      model_key: 'claude-code-cli'
    };

    // Platform-specific optimizations
    if (Platform.isMobile) {
      settings.timeout = 90000; // Longer timeout for mobile
      settings.context_limit = 3; // Less context for mobile
    }
    
    // TODO: Could add more sophisticated system detection
    // For now, use conservative defaults
    
    return settings;
  }

  /**
   * Test Claude Code CLI connection
   */
  async testConnection() {
    try {
      const adapter = this.getClaudeCodeCLIAdapter();
      if (!adapter) {
        return { success: false, error: 'Adapter not available' };
      }

      if (typeof adapter.validate_connection === 'function') {
        const isAvailable = await adapter.validate_connection();
        return { 
          success: isAvailable,
          error: isAvailable ? null : 'Connection validation failed'
        };
      }

      return { success: true }; // Assume success if no validation method
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark first-run as complete
   */
  async markFirstRunComplete() {
    this.settings.first_run_complete = true;
    await this.plugin.saveSettings();
  }

  /**
   * Show setup modal for new users
   */
  showSetupModal(availability, setupSteps) {
    try {
      const modal = new ClaudeCliSetupModal(this.plugin.app, this.plugin, {
        availability,
        setupSteps,
        onComplete: (success) => {
          if (success) {
            this.showSuccessMessage();
          }
        }
      });
      
      modal.open();
      console.log('Showing setup modal:', { availability, setupSteps });
    } catch (error) {
      console.error('Failed to show setup modal:', error);
      // Fallback to simple notice
      this.showWelcomeNotice(availability, setupSteps);
    }
  }

  /**
   * Show welcome notice as fallback
   */
  showWelcomeNotice(availability, setupSteps) {
    const instructions = this.getInstallationInstructions();
    
    // Create a notice with setup guidance
    const message = `
      Welcome to Smart Connections! 
      
      To get started with private, local AI processing:
      1. ${instructions.steps.join('\n      2. ')}
      
      Benefits of local processing:
      • Complete privacy - your data never leaves your machine
      • No API costs or usage limits
      • Works offline
    `;

    // Show as Obsidian notice
    new Notice(message.trim(), 10000);
    
    console.log('Showing welcome notice:', { availability, setupSteps, instructions });
  }

  /**
   * Show setup guide for troubleshooting
   */
  showSetupGuide(availability, setupSteps) {
    const errorMessage = this.generateErrorMessage('cli_not_working', { error: availability.error });
    
    const message = `${errorMessage.title}: ${errorMessage.message}`;
    new Notice(message, 8000);
    
    console.log('Showing setup guide:', errorMessage);
  }

  /**
   * Show success message
   */
  showSuccessMessage() {
    const message = '✅ Smart Connections is ready! Claude Code CLI is working correctly.';
    new Notice(message, 5000);
  }

  /**
   * Show error guide
   */
  showErrorGuide(error) {
    const message = `Smart Connections setup error: ${error.message}. Please check settings.`;
    new Notice(message, 8000);
  }

  /**
   * Get platform-specific installation instructions
   */
  getInstallationInstructions() {
    const platform = Platform.isMacOS ? 'darwin' : Platform.isWin ? 'win32' : 'linux';
    
    const instructions = {
      darwin: {
        title: 'Install on macOS',
        steps: [
          'Download Claude Code CLI from claude.ai/code',
          'Follow the installation wizard',
          'Restart Obsidian after installation'
        ],
        downloadUrl: 'https://claude.ai/code'
      },
      win32: {
        title: 'Install on Windows', 
        steps: [
          'Download Claude Code CLI from claude.ai/code',
          'Run the installer as Administrator',
          'Restart Obsidian after installation'
        ],
        downloadUrl: 'https://claude.ai/code'
      },
      linux: {
        title: 'Install on Linux',
        steps: [
          'Download Claude Code CLI from claude.ai/code',
          'Install using your package manager',
          'Add to PATH if necessary',
          'Restart Obsidian after installation'
        ],
        downloadUrl: 'https://claude.ai/code'
      }
    };

    return instructions[platform] || instructions.darwin;
  }

  /**
   * Generate helpful error messages
   */
  generateErrorMessage(errorType, context = {}) {
    const messages = {
      cli_not_found: {
        title: 'Claude Code CLI Not Found',
        message: 'Claude Code CLI is required for local AI processing but was not found on your system.',
        actions: [
          { text: 'Install Claude Code CLI', action: 'install', primary: true },
          { text: 'Use External API Instead', action: 'switch_adapter', primary: false }
        ]
      },
      cli_not_working: {
        title: 'Claude Code CLI Not Working',
        message: `Claude Code CLI is installed but not responding. ${context.error || 'Please check your installation.'}`,
        actions: [
          { text: 'Reinstall Claude Code CLI', action: 'reinstall', primary: true },
          { text: 'Check Installation Guide', action: 'help', primary: false }
        ]
      },
      permission_denied: {
        title: 'Permission Denied',
        message: 'Claude Code CLI cannot be executed due to permission restrictions.',
        actions: [
          { text: 'Fix Permissions', action: 'fix_permissions', primary: true },
          { text: 'Run as Administrator', action: 'run_as_admin', primary: false }
        ]
      }
    };

    return messages[errorType] || messages.cli_not_found;
  }

  /**
   * Validate existing Claude Code CLI setup (for returning users)
   */
  async validateClaudeCodeCLISetup() {
    try {
      const availability = await this.checkClaudeCodeCLIAvailability();
      
      if (!availability.available) {
        // Show subtle reminder for existing users
        console.log('Claude Code CLI not available for existing user');
        // Could show a subtle notice or update status indicator
      }
    } catch (error) {
      console.error('Claude Code CLI validation failed:', error);
    }
  }
}