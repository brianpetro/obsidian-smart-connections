import test from 'ava';

/**
 * Test first-run experience and Claude Code CLI availability detection
 * Ensures smooth setup for new users
 */

// Mock CLI availability checker
const createMockAvailabilityChecker = (isAvailable = true) => ({
  async checkClaudeCodeCLIAvailability() {
    return {
      available: isAvailable,
      version: isAvailable ? '1.0.0' : null,
      path: isAvailable ? '/usr/local/bin/claude' : null,
      error: isAvailable ? null : 'Claude Code CLI not found in PATH'
    };
  }
});

// Mock settings structure
const createMockSettings = (hasRunBefore = false) => ({
  smart_chat_model: {
    adapter: 'claude_code_cli',
    claude_code_cli: {
      model_key: 'claude-code-cli',
      timeout: 60000,
      max_retries: 3,
      context_limit: 5
    }
  },
  first_run_complete: hasRunBefore
});

test('should detect Claude Code CLI availability', async t => {
  const checker = createMockAvailabilityChecker(true);
  const result = await checker.checkClaudeCodeCLIAvailability();
  
  t.true(result.available, 'Should detect available CLI');
  t.truthy(result.version, 'Should return version');
  t.truthy(result.path, 'Should return path');
  t.falsy(result.error, 'Should not have error when available');
});

test('should detect Claude Code CLI unavailability', async t => {
  const checker = createMockAvailabilityChecker(false);
  const result = await checker.checkClaudeCodeCLIAvailability();
  
  t.false(result.available, 'Should detect unavailable CLI');
  t.falsy(result.version, 'Should not return version');
  t.falsy(result.path, 'Should not return path');
  t.truthy(result.error, 'Should have error message');
});

test('should identify first-run users', t => {
  const isFirstRun = (settings) => {
    return !settings.first_run_complete;
  };

  const newUserSettings = createMockSettings(false);
  const returningUserSettings = createMockSettings(true);

  t.true(isFirstRun(newUserSettings), 'Should identify new users');
  t.false(isFirstRun(returningUserSettings), 'Should identify returning users');
});

test('should generate first-run setup steps', t => {
  const generateSetupSteps = (availability) => {
    const steps = [];
    
    if (!availability.available) {
      steps.push({
        title: 'Install Claude Code CLI',
        description: 'Claude Code CLI is required for local AI processing',
        action: 'install_claude_cli',
        required: true
      });
    }
    
    steps.push({
      title: 'Configure Settings',
      description: 'Optimize settings for your system',
      action: 'configure_settings',
      required: false
    });
    
    steps.push({
      title: 'Test Connection',
      description: 'Verify everything works correctly',
      action: 'test_connection',
      required: true
    });

    return steps;
  };

  const availableSteps = generateSetupSteps({ available: true });
  const unavailableSteps = generateSetupSteps({ available: false });

  t.is(availableSteps.length, 2, 'Should have 2 steps when CLI available');
  t.is(unavailableSteps.length, 3, 'Should have 3 steps when CLI unavailable');
  
  const installStep = unavailableSteps.find(step => step.action === 'install_claude_cli');
  t.truthy(installStep, 'Should include installation step');
  t.true(installStep.required, 'Installation should be required');
});

test('should generate platform-specific installation instructions', t => {
  const getInstallationInstructions = (platform = 'darwin') => {
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
  };

  const macInstructions = getInstallationInstructions('darwin');
  const windowsInstructions = getInstallationInstructions('win32');
  const linuxInstructions = getInstallationInstructions('linux');

  t.truthy(macInstructions.title, 'Should have macOS instructions');
  t.truthy(windowsInstructions.title, 'Should have Windows instructions');
  t.truthy(linuxInstructions.title, 'Should have Linux instructions');
  
  t.true(Array.isArray(macInstructions.steps), 'Should have step arrays');
  t.true(macInstructions.steps.length > 0, 'Should have installation steps');
});

test('should generate optimal default settings', t => {
  const generateOptimalSettings = (systemInfo = {}) => {
    const settings = {
      timeout: 60000, // Base timeout
      max_retries: 3,
      context_limit: 5
    };

    // Adjust based on system capabilities
    if (systemInfo.slowSystem) {
      settings.timeout = 90000; // Longer timeout for slow systems
      settings.max_retries = 2; // Fewer retries to avoid delays
    }
    
    if (systemInfo.fastSystem) {
      settings.timeout = 45000; // Shorter timeout for fast systems
      settings.context_limit = 10; // More context for better responses
    }

    return settings;
  };

  const defaultSettings = generateOptimalSettings();
  const slowSystemSettings = generateOptimalSettings({ slowSystem: true });
  const fastSystemSettings = generateOptimalSettings({ fastSystem: true });

  t.is(defaultSettings.timeout, 60000, 'Should have default timeout');
  t.is(slowSystemSettings.timeout, 90000, 'Should increase timeout for slow systems');
  t.is(fastSystemSettings.timeout, 45000, 'Should decrease timeout for fast systems');
  t.is(fastSystemSettings.context_limit, 10, 'Should increase context for fast systems');
});

test('should generate helpful error messages', t => {
  const generateErrorMessage = (errorType, context = {}) => {
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
  };

  const notFoundError = generateErrorMessage('cli_not_found');
  const notWorkingError = generateErrorMessage('cli_not_working', { error: 'Timeout occurred' });
  const permissionError = generateErrorMessage('permission_denied');

  t.is(notFoundError.title, 'Claude Code CLI Not Found', 'Should have correct title');
  t.true(Array.isArray(notFoundError.actions), 'Should have action array');
  t.true(notFoundError.actions.length > 0, 'Should have available actions');
  
  t.true(notWorkingError.message.includes('Timeout occurred'), 'Should include context error');
  t.is(permissionError.actions[0].action, 'fix_permissions', 'Should have appropriate action');
});

test('should track setup completion', t => {
  const trackSetupProgress = (steps, completedSteps = []) => {
    const progress = steps.map(step => ({
      ...step,
      completed: completedSteps.includes(step.action),
      status: completedSteps.includes(step.action) ? 'completed' : 'pending'
    }));

    const requiredSteps = progress.filter(step => step.required);
    const completedRequired = requiredSteps.filter(step => step.completed);
    
    return {
      steps: progress,
      totalSteps: steps.length,
      completedSteps: completedSteps.length,
      requiredSteps: requiredSteps.length,
      completedRequired: completedRequired.length,
      isComplete: completedRequired.length === requiredSteps.length
    };
  };

  const steps = [
    { action: 'install_claude_cli', required: true },
    { action: 'configure_settings', required: false },
    { action: 'test_connection', required: true }
  ];

  const noProgress = trackSetupProgress(steps, []);
  const partialProgress = trackSetupProgress(steps, ['install_claude_cli']);
  const completeProgress = trackSetupProgress(steps, ['install_claude_cli', 'test_connection']);

  t.false(noProgress.isComplete, 'Should not be complete with no progress');
  t.false(partialProgress.isComplete, 'Should not be complete with partial progress');
  t.true(completeProgress.isComplete, 'Should be complete when all required steps done');
  
  t.is(completeProgress.completedRequired, 2, 'Should track required step completion');
});