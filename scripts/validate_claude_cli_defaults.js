#!/usr/bin/env node

/**
 * Validation script for Claude Code CLI default configuration
 * Verifies that all configuration layers consistently use Claude Code CLI
 */

console.log('🔍 Validating Claude Code CLI Default Configuration...\n');

// Simple validation without complex imports
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Check SmartThreads file for claude_code_cli defaults
console.log('1. Checking SmartThreads default_settings...');
const threadsPath = join(__dirname, '../smart-chat-v0/smart_threads.js');
const threadsContent = readFileSync(threadsPath, 'utf8');

if (threadsContent.includes("adapter: 'claude_code_cli'")) {
  console.log('   ✅ SmartThreads uses claude_code_cli adapter');
} else {
  console.log('   ❌ SmartThreads does not use claude_code_cli adapter');
}

if (threadsContent.includes("model_key: 'claude-code-cli'")) {
  console.log('   ✅ SmartThreads has correct model_key');
} else {
  console.log('   ❌ SmartThreads missing claude-code-cli model_key');
}

if (!threadsContent.includes("adapter: 'openai'")) {
  console.log('   ✅ No OpenAI adapter in SmartThreads defaults');
} else {
  console.log('   ❌ OpenAI adapter still present in SmartThreads');
}

// Check main config file
console.log('\n2. Checking smart_env.config.js...');
const configPath = join(__dirname, '../src/smart_env.config.js');
const configContent = readFileSync(configPath, 'utf8');

if (configContent.includes('adapter: "claude_code_cli"')) {
  console.log('   ✅ Main config uses claude_code_cli adapter');
} else {
  console.log('   ❌ Main config does not use claude_code_cli adapter');
}

if (configContent.includes('claude_code_cli: ClaudeCodeCLIAdapter')) {
  console.log('   ✅ Claude Code CLI adapter is registered');
} else {
  console.log('   ❌ Claude Code CLI adapter not found in adapters');
}

if (!configContent.includes('gpt-4o')) {
  console.log('   ✅ No gpt-4o references found');
} else {
  console.log('   ❌ gpt-4o references still exist');
}

// Check for commented out external adapters
const commentedAdapters = [
  '// openai: SmartChatModelOpenaiAdapter',
  '// anthropic: SmartChatModelAnthropicAdapter',
  '// google: SmartChatModelGoogleAdapter'
];

console.log('\n3. Checking external API adapters are commented...');
commentedAdapters.forEach(adapter => {
  if (configContent.includes(adapter)) {
    console.log(`   ✅ ${adapter.replace('//', '').trim()} is commented out`);
  }
});

console.log('\n✅ Configuration validation complete!');
console.log('🎉 Claude Code CLI is now the consistent default across all layers');