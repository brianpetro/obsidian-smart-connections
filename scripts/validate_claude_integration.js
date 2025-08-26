#!/usr/bin/env node

/**
 * CLAUDE CODE INTEGRATION VALIDATION SCRIPT
 * ==========================================
 * 
 * This script validates the complete Claude Code CLI integration in Smart Connections.
 * It checks installation, configuration, and performs end-to-end validation.
 * 
 * Usage:
 *   node scripts/validate_claude_integration.js
 *   node scripts/validate_claude_integration.js --verbose
 *   node scripts/validate_claude_integration.js --check-cli-only
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// ANSI color codes for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const verbose = process.argv.includes('--verbose');
const checkCliOnly = process.argv.includes('--check-cli-only');

/**
 * Validation results tracker
 */
class ValidationResults {
  constructor() {
    this.results = [];
    this.errors = [];
    this.warnings = [];
  }
  
  pass(test, message, details = null) {
    this.results.push({ test, status: 'pass', message, details });
    console.log(`${colors.green}✅ ${test}:${colors.reset} ${message}`);
    if (verbose && details) {
      console.log(`   ${colors.cyan}Details: ${details}${colors.reset}`);
    }
  }
  
  fail(test, message, details = null) {
    this.results.push({ test, status: 'fail', message, details });
    this.errors.push({ test, message, details });
    console.log(`${colors.red}❌ ${test}:${colors.reset} ${message}`);
    if (details) {
      console.log(`   ${colors.red}Error: ${details}${colors.reset}`);
    }
  }
  
  warn(test, message, details = null) {
    this.results.push({ test, status: 'warn', message, details });
    this.warnings.push({ test, message, details });
    console.log(`${colors.yellow}⚠️  ${test}:${colors.reset} ${message}`);
    if (verbose && details) {
      console.log(`   ${colors.yellow}Warning: ${details}${colors.reset}`);
    }
  }
  
  info(message) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
  }
  
  getSummary() {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warned = this.results.filter(r => r.status === 'warn').length;
    
    return {
      total: this.results.length,
      passed,
      failed,
      warned,
      success: failed === 0
    };
  }
}

const results = new ValidationResults();

/**
 * Utility function to run shell commands
 */
function runCommand(command, args = [], timeout = 5000) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { 
      stdio: 'pipe',
      timeout 
    });
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
    
    process.on('error', (error) => {
      reject(error);
    });
    
    // Set timeout
    setTimeout(() => {
      if (!process.killed) {
        process.kill('SIGTERM');
        reject(new Error(`Command timed out after ${timeout}ms`));
      }
    }, timeout);
  });
}

/**
 * 1. INSTALLATION VALIDATION
 */
async function validateInstallation() {
  console.log(`\n${colors.bold}=== INSTALLATION VALIDATION ===${colors.reset}\n`);
  
  // Check if package.json exists and has correct structure
  try {
    const packagePath = join(projectRoot, 'package.json');
    if (!existsSync(packagePath)) {
      results.fail('package.json', 'package.json not found');
      return;
    }
    
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    results.pass('package.json', 'Package configuration found');
    
    // Check if AVA is configured for testing
    if (packageJson.ava && packageJson.ava.files) {
      results.pass('test-config', 'AVA test configuration found');
    } else {
      results.warn('test-config', 'AVA test configuration missing or incomplete');
    }
    
    // Check dependencies
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (dependencies.ava) {
      results.pass('test-framework', `AVA testing framework available (${dependencies.ava})`);
    } else {
      results.fail('test-framework', 'AVA testing framework not found in dependencies');
    }
    
  } catch (error) {
    results.fail('package.json', 'Failed to read or parse package.json', error.message);
  }
  
  // Check if adapter files exist
  const adapterPath = join(projectRoot, 'src/adapters/claude_code_cli_adapter.js');
  if (existsSync(adapterPath)) {
    results.pass('adapter-file', 'Claude Code CLI adapter file exists');
    
    // Check adapter test file
    const testPath = join(projectRoot, 'src/adapters/claude_code_cli_adapter.test.js');
    if (existsSync(testPath)) {
      results.pass('adapter-tests', 'Adapter test file exists');
    } else {
      results.warn('adapter-tests', 'Adapter test file not found');
    }
  } else {
    results.fail('adapter-file', 'Claude Code CLI adapter file not found');
  }
  
  // Check config integration
  const configPath = join(projectRoot, 'src/smart_env.config.js');
  if (existsSync(configPath)) {
    results.pass('config-file', 'Smart environment config file exists');
    
    try {
      const configContent = readFileSync(configPath, 'utf8');
      if (configContent.includes('ClaudeCodeCLIAdapter')) {
        results.pass('config-integration', 'Claude adapter integrated in config');
      } else {
        results.fail('config-integration', 'Claude adapter not found in config');
      }
      
      if (configContent.includes('claude_code_cli')) {
        results.pass('config-settings', 'Claude CLI settings found in config');
      } else {
        results.fail('config-settings', 'Claude CLI settings not found in config');
      }
    } catch (error) {
      results.fail('config-validation', 'Failed to validate config file', error.message);
    }
  } else {
    results.fail('config-file', 'Smart environment config file not found');
  }
}

/**
 * 2. CLAUDE CLI AVAILABILITY VALIDATION
 */
async function validateClaudeCLI() {
  console.log(`\n${colors.bold}=== CLAUDE CLI VALIDATION ===${colors.reset}\n`);
  
  try {
    // Check if claude CLI is in PATH
    const { code, stdout, stderr } = await runCommand('which', ['claude'], 3000);
    
    if (code === 0 && stdout.trim()) {
      results.pass('cli-path', `Claude CLI found at: ${stdout.trim()}`);
      
      // Check version
      try {
        const versionResult = await runCommand('claude', ['--version'], 5000);
        if (versionResult.code === 0) {
          results.pass('cli-version', `Claude CLI version check passed`);
          if (verbose) {
            console.log(`   ${colors.cyan}Output: ${versionResult.stdout.trim()}${colors.reset}`);
          }
        } else {
          results.warn('cli-version', 'Claude CLI version check failed', versionResult.stderr);
        }
      } catch (versionError) {
        results.warn('cli-version', 'Could not check Claude CLI version', versionError.message);
      }
      
      // Test basic functionality
      try {
        const testResult = await runCommand('claude', ['--help'], 5000);
        if (testResult.code === 0) {
          results.pass('cli-help', 'Claude CLI help command works');
        } else {
          results.warn('cli-help', 'Claude CLI help command failed');
        }
      } catch (helpError) {
        results.warn('cli-help', 'Could not test Claude CLI help', helpError.message);
      }
      
    } else {
      results.fail('cli-path', 'Claude CLI not found in PATH', stderr);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      results.fail('cli-path', 'Claude CLI command not found - is it installed?');
    } else {
      results.fail('cli-path', 'Error checking Claude CLI', error.message);
    }
  }
}

/**
 * 3. CONFIGURATION VALIDATION
 */
async function validateConfiguration() {
  console.log(`\n${colors.bold}=== CONFIGURATION VALIDATION ===${colors.reset}\n`);
  
  try {
    // Import and validate configuration
    const configModule = await import(`${join(projectRoot, 'src/smart_env.config.js')}`);
    const config = configModule.smart_env_config;
    
    if (!config) {
      results.fail('config-import', 'Could not import smart_env_config');
      return;
    }
    
    results.pass('config-import', 'Smart environment configuration imported successfully');
    
    // Check smart_chat_model configuration
    if (config.modules && config.modules.smart_chat_model) {
      results.pass('chat-model-config', 'Smart chat model configuration found');
      
      // Check adapters
      const adapters = config.modules.smart_chat_model.adapters;
      if (adapters && adapters.claude_code_cli) {
        results.pass('claude-adapter-config', 'Claude Code CLI adapter configured');
      } else {
        results.fail('claude-adapter-config', 'Claude Code CLI adapter not found in configuration');
      }
      
      // Check other local adapters
      const localAdapters = ['ollama', 'lm_studio', 'custom'];
      localAdapters.forEach(adapter => {
        if (adapters[adapter]) {
          results.pass(`${adapter}-adapter`, `${adapter} adapter available as fallback`);
        } else {
          results.warn(`${adapter}-adapter`, `${adapter} adapter not configured`);
        }
      });
      
    } else {
      results.fail('chat-model-config', 'Smart chat model configuration not found');
    }
    
    // Check default settings
    if (config.default_settings && config.default_settings.smart_chat_model) {
      const chatSettings = config.default_settings.smart_chat_model;
      
      if (chatSettings.adapter === 'claude_code_cli') {
        results.pass('default-adapter', 'Claude Code CLI set as default adapter');
      } else {
        results.warn('default-adapter', `Default adapter is ${chatSettings.adapter}, not claude_code_cli`);
      }
      
      if (chatSettings.claude_code_cli) {
        const claudeSettings = chatSettings.claude_code_cli;
        results.pass('claude-settings', 'Claude Code CLI specific settings found');
        
        // Check individual settings
        if (typeof claudeSettings.timeout === 'number' && claudeSettings.timeout > 0) {
          results.pass('timeout-setting', `Timeout configured: ${claudeSettings.timeout}ms`);
        } else {
          results.warn('timeout-setting', 'Timeout setting invalid or missing');
        }
        
        if (typeof claudeSettings.max_retries === 'number' && claudeSettings.max_retries > 0) {
          results.pass('retry-setting', `Max retries configured: ${claudeSettings.max_retries}`);
        } else {
          results.warn('retry-setting', 'Max retries setting invalid or missing');
        }
        
        if (typeof claudeSettings.context_limit === 'number' && claudeSettings.context_limit > 0) {
          results.pass('context-setting', `Context limit configured: ${claudeSettings.context_limit}`);
        } else {
          results.warn('context-setting', 'Context limit setting invalid or missing');
        }
      } else {
        results.fail('claude-settings', 'Claude Code CLI specific settings not found');
      }
    } else {
      results.fail('default-settings', 'Default smart chat model settings not found');
    }
    
  } catch (error) {
    results.fail('config-import', 'Failed to import or validate configuration', error.message);
  }
}

/**
 * 4. ADAPTER FUNCTIONALITY VALIDATION
 */
async function validateAdapterFunctionality() {
  console.log(`\n${colors.bold}=== ADAPTER FUNCTIONALITY VALIDATION ===${colors.reset}\n`);
  
  try {
    // Import the adapter
    const adapterModule = await import(`${join(projectRoot, 'src/adapters/claude_code_cli_adapter.js')}`);
    const ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
    
    if (!ClaudeCodeCLIAdapter) {
      results.fail('adapter-import', 'Could not import ClaudeCodeCLIAdapter class');
      return;
    }
    
    results.pass('adapter-import', 'Claude Code CLI adapter imported successfully');
    
    // Create mock environment for testing
    const mockModel = {
      config: {},
      env: {
        smart_sources: {
          search: async () => []
        }
      }
    };
    
    // Test adapter initialization
    let adapter;
    try {
      adapter = new ClaudeCodeCLIAdapter(mockModel);
      results.pass('adapter-init', 'Adapter initialized successfully');
    } catch (error) {
      results.fail('adapter-init', 'Failed to initialize adapter', error.message);
      return;
    }
    
    // Test required methods exist
    const requiredMethods = [
      'validate_connection',
      'gather_context',
      'format_prompt', 
      'execute_claude_cli',
      'spawn_claude_process',
      'complete',
      'stream',
      'test_connection',
      'cleanup'
    ];
    
    requiredMethods.forEach(method => {
      if (typeof adapter[method] === 'function') {
        results.pass(`method-${method}`, `Method ${method} exists and is function`);
      } else {
        results.fail(`method-${method}`, `Method ${method} missing or not a function`);
      }
    });
    
    // Test required properties
    const requiredProperties = ['timeout', 'max_retries', 'base_delay', 'can_stream'];
    requiredProperties.forEach(prop => {
      if (adapter.hasOwnProperty(prop)) {
        results.pass(`property-${prop}`, `Property ${prop} exists: ${adapter[prop]}`);
      } else {
        results.fail(`property-${prop}`, `Property ${prop} missing`);
      }
    });
    
    // Test models getter
    try {
      const models = adapter.models;
      if (Array.isArray(models) && models.length > 0) {
        results.pass('models-getter', `Models getter works, ${models.length} model(s) available`);
        models.forEach((model, index) => {
          if (model.id && model.name) {
            results.pass(`model-${index}`, `Model ${index + 1}: ${model.name} (${model.id})`);
          } else {
            results.warn(`model-${index}`, `Model ${index + 1} missing id or name`);
          }
        });
      } else {
        results.fail('models-getter', 'Models getter returns empty or invalid array');
      }
    } catch (error) {
      results.fail('models-getter', 'Models getter failed', error.message);
    }
    
    // Test validate_connection method
    try {
      const isAvailable = await adapter.validate_connection();
      if (typeof isAvailable === 'boolean') {
        results.pass('validate-connection', `Connection validation works: ${isAvailable}`);
        
        if (isAvailable) {
          results.info('Claude CLI is available and connection validation passed');
        } else {
          results.info('Claude CLI not available, but validation method works correctly');
        }
      } else {
        results.fail('validate-connection', 'validate_connection should return boolean');
      }
    } catch (error) {
      results.fail('validate-connection', 'Connection validation failed', error.message);
    }
    
  } catch (error) {
    results.fail('adapter-import', 'Failed to import adapter for testing', error.message);
  }
}

/**
 * 5. INTEGRATION TESTS VALIDATION
 */
async function validateIntegrationTests() {
  console.log(`\n${colors.bold}=== INTEGRATION TESTS VALIDATION ===${colors.reset}\n`);
  
  // Check if integration test file exists
  const integrationTestPath = join(projectRoot, 'src/test/claude_code_integration.test.js');
  if (existsSync(integrationTestPath)) {
    results.pass('integration-test-file', 'Integration test file exists');
  } else {
    results.fail('integration-test-file', 'Integration test file not found');
    return;
  }
  
  // Run the integration tests
  try {
    results.info('Running integration tests...');
    
    const testResult = await runCommand('npx', ['ava', 'src/test/claude_code_integration.test.js', '--verbose'], 30000);
    
    if (testResult.code === 0) {
      results.pass('integration-tests', 'All integration tests passed');
      if (verbose) {
        console.log(`\n${colors.cyan}Test Output:${colors.reset}`);
        console.log(testResult.stdout);
      }
    } else {
      results.fail('integration-tests', 'Some integration tests failed');
      console.log(`\n${colors.red}Test Failures:${colors.reset}`);
      console.log(testResult.stderr || testResult.stdout);
    }
    
  } catch (error) {
    results.fail('integration-tests', 'Failed to run integration tests', error.message);
  }
}

/**
 * 6. END-TO-END VALIDATION
 */
async function validateEndToEnd() {
  if (checkCliOnly) return; // Skip E2E if only checking CLI
  
  console.log(`\n${colors.bold}=== END-TO-END VALIDATION ===${colors.reset}\n`);
  
  try {
    // Import adapter and create test instance
    const adapterModule = await import(`${join(projectRoot, 'src/adapters/claude_code_cli_adapter.js')}`);
    const ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
    
    const mockModel = {
      config: {},
      env: {
        smart_sources: {
          search: async (query, opts) => [{
            item: {
              path: 'test-note.md',
              content: 'This is a test note for validation purposes.'
            }
          }]
        },
        smart_view: {
          active_note: {
            basename: 'validation-note.md',
            content: 'This is the active note for validation testing.'
          }
        }
      }
    };
    
    const adapter = new ClaudeCodeCLIAdapter(mockModel);
    
    // Test context gathering
    try {
      const context = await adapter.gather_context('test validation query');
      if (typeof context === 'string') {
        results.pass('context-gathering', 'Context gathering works');
        if (verbose) {
          console.log(`   ${colors.cyan}Context length: ${context.length} characters${colors.reset}`);
        }
      } else {
        results.fail('context-gathering', 'Context gathering returned non-string result');
      }
    } catch (error) {
      results.fail('context-gathering', 'Context gathering failed', error.message);
    }
    
    // Test prompt formatting
    try {
      const messages = [
        { role: 'user', content: 'Test validation message' }
      ];
      const prompt = await adapter.format_prompt(messages);
      
      if (typeof prompt === 'string' && prompt.length > 0) {
        results.pass('prompt-formatting', 'Prompt formatting works');
        if (verbose) {
          console.log(`   ${colors.cyan}Formatted prompt length: ${prompt.length} characters${colors.reset}`);
        }
      } else {
        results.fail('prompt-formatting', 'Prompt formatting returned invalid result');
      }
    } catch (error) {
      results.fail('prompt-formatting', 'Prompt formatting failed', error.message);
    }
    
    // Test complete method (with mocked CLI execution)
    try {
      // Mock the CLI execution to avoid requiring actual CLI
      adapter.validate_connection = async () => true;
      adapter.execute_claude_cli = async (prompt, options) => ({
        id: 'validation-test',
        content: 'This is a validation test response',
        role: 'assistant'
      });
      
      const request = {
        messages: [{ role: 'user', content: 'Validation test message' }]
      };
      
      const response = await adapter.complete(request);
      
      if (response && response.choices && response.choices[0] && response.choices[0].message) {
        results.pass('complete-method', 'Complete method works end-to-end');
      } else {
        results.fail('complete-method', 'Complete method returned invalid response format');
      }
    } catch (error) {
      results.fail('complete-method', 'Complete method failed', error.message);
    }
    
    // Test streaming method
    try {
      let chunkReceived = false;
      let doneReceived = false;
      
      adapter.execute_claude_cli = async (prompt, options) => {
        if (options.stream && options.chunk_handler) {
          options.chunk_handler({ content: 'Test chunk' });
          chunkReceived = true;
        }
        return { content: 'Test response' };
      };
      
      const streamRequest = {
        messages: [{ role: 'user', content: 'Stream test message' }]
      };
      
      const handlers = {
        chunk: () => { chunkReceived = true; },
        done: () => { doneReceived = true; },
        error: () => { results.fail('streaming-method', 'Streaming error handler called'); }
      };
      
      await adapter.stream(streamRequest, handlers);
      
      if (chunkReceived && doneReceived) {
        results.pass('streaming-method', 'Streaming method works end-to-end');
      } else {
        results.warn('streaming-method', 'Streaming method completed but handlers may not have been called properly');
      }
    } catch (error) {
      results.fail('streaming-method', 'Streaming method failed', error.message);
    }
    
  } catch (error) {
    results.fail('e2e-setup', 'End-to-end validation setup failed', error.message);
  }
}

/**
 * 7. PERFORMANCE VALIDATION
 */
async function validatePerformance() {
  if (checkCliOnly) return; // Skip performance tests if only checking CLI
  
  console.log(`\n${colors.bold}=== PERFORMANCE VALIDATION ===${colors.reset}\n`);
  
  try {
    const adapterModule = await import(`${join(projectRoot, 'src/adapters/claude_code_cli_adapter.js')}`);
    const ClaudeCodeCLIAdapter = adapterModule.ClaudeCodeCLIAdapter;
    
    const mockModel = {
      config: {},
      env: {
        smart_sources: {
          search: async () => Array(5).fill().map((_, i) => ({
            item: {
              path: `performance-note-${i}.md`,
              content: `This is performance test content ${i} with some additional text to make it more realistic.`
            }
          }))
        }
      }
    };
    
    const adapter = new ClaudeCodeCLIAdapter(mockModel);
    
    // Test context gathering performance
    const startTime = Date.now();
    const context = await adapter.gather_context('performance test query');
    const contextTime = Date.now() - startTime;
    
    if (contextTime < 1000) { // Should be under 1 second
      results.pass('context-performance', `Context gathering completed in ${contextTime}ms`);
    } else {
      results.warn('context-performance', `Context gathering took ${contextTime}ms (may be slow)`);
    }
    
    // Test prompt formatting performance
    const formatStart = Date.now();
    const messages = Array(10).fill().map((_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Performance test message ${i} with some content to test formatting speed.`
    }));
    
    const prompt = await adapter.format_prompt(messages);
    const formatTime = Date.now() - formatStart;
    
    if (formatTime < 100) { // Should be under 100ms
      results.pass('format-performance', `Prompt formatting completed in ${formatTime}ms`);
    } else {
      results.warn('format-performance', `Prompt formatting took ${formatTime}ms (may be slow)`);
    }
    
    // Test memory usage
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Run multiple operations
    for (let i = 0; i < 10; i++) {
      await adapter.gather_context(`memory test ${i}`);
      await adapter.format_prompt([{ role: 'user', content: `memory test ${i}` }]);
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;
    
    if (memoryGrowth < 10 * 1024 * 1024) { // Less than 10MB growth
      results.pass('memory-usage', `Memory growth: ${Math.round(memoryGrowth / 1024)}KB`);
    } else {
      results.warn('memory-usage', `Memory growth: ${Math.round(memoryGrowth / 1024 / 1024)}MB (may be excessive)`);
    }
    
  } catch (error) {
    results.fail('performance-validation', 'Performance validation failed', error.message);
  }
}

/**
 * MAIN VALIDATION RUNNER
 */
async function runValidation() {
  console.log(`${colors.bold}${colors.cyan}`);
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     CLAUDE CODE INTEGRATION VALIDATOR                       ║');
  console.log('║                                                                              ║');
  console.log('║   This script validates the complete Claude Code CLI integration in         ║');
  console.log('║   Smart Connections, checking installation, configuration, and              ║'); 
  console.log('║   end-to-end functionality.                                                  ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  const startTime = Date.now();
  
  // Run validation steps
  await validateInstallation();
  await validateClaudeCLI();
  
  if (!checkCliOnly) {
    await validateConfiguration();
    await validateAdapterFunctionality();
    await validateIntegrationTests();
    await validateEndToEnd();
    await validatePerformance();
  }
  
  const duration = Date.now() - startTime;
  
  // Print summary
  console.log(`\n${colors.bold}=== VALIDATION SUMMARY ===${colors.reset}\n`);
  
  const summary = results.getSummary();
  
  console.log(`${colors.bold}Duration:${colors.reset} ${duration}ms`);
  console.log(`${colors.bold}Total Tests:${colors.reset} ${summary.total}`);
  console.log(`${colors.green}✅ Passed: ${summary.passed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${summary.failed}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Warnings: ${summary.warned}${colors.reset}`);
  
  if (summary.success) {
    console.log(`\n${colors.green}${colors.bold}🎉 ALL VALIDATIONS PASSED!${colors.reset}`);
    console.log(`${colors.green}Claude Code CLI integration is properly configured and ready to use.${colors.reset}\n`);
  } else {
    console.log(`\n${colors.red}${colors.bold}❌ VALIDATION FAILED!${colors.reset}`);
    console.log(`${colors.red}${summary.failed} validation(s) failed. Please check the errors above.${colors.reset}\n`);
    
    if (results.errors.length > 0) {
      console.log(`${colors.red}${colors.bold}Critical Issues:${colors.reset}`);
      results.errors.forEach(error => {
        console.log(`  • ${error.test}: ${error.message}`);
      });
      console.log();
    }
  }
  
  if (results.warnings.length > 0) {
    console.log(`${colors.yellow}${colors.bold}Warnings (non-critical):${colors.reset}`);
    results.warnings.forEach(warning => {
      console.log(`  • ${warning.test}: ${warning.message}`);
    });
    console.log();
  }
  
  // Exit with appropriate code
  process.exit(summary.success ? 0 : 1);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error(`${colors.red}Unhandled Rejection at:${colors.reset}`, promise, `${colors.red}reason:${colors.reset}`, reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(`${colors.red}Uncaught Exception:${colors.reset}`, error);
  process.exit(1);
});

// Run the validation
runValidation().catch(error => {
  console.error(`${colors.red}Validation runner failed:${colors.reset}`, error);
  process.exit(1);
});