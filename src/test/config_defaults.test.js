import test from 'ava';
import { smart_env_config } from '../smart_env.config.js';

/**
 * Test configuration for Claude Code CLI defaults
 * Ensures smart_env_config has the correct Claude Code CLI settings
 */

test('smart_env_config should use claude_code_cli as primary adapter', t => {
  const chatModelConfig = smart_env_config.default_settings.smart_chat_model;
  
  t.is(chatModelConfig.adapter, 'claude_code_cli', 'Main config should default to claude_code_cli');
  t.is(chatModelConfig.model_key, 'claude-code-cli', 'Main config should have claude-code-cli model_key');
  t.truthy(chatModelConfig.claude_code_cli, 'Should have claude_code_cli configuration');
});

test('chat model adapters should have claude_code_cli as first option', t => {
  const adapters = smart_env_config.modules.smart_chat_model.adapters;
  const adapterKeys = Object.keys(adapters);
  
  t.is(adapterKeys[0], 'claude_code_cli', 'claude_code_cli should be the first adapter in the list');
  t.truthy(adapters.claude_code_cli, 'claude_code_cli adapter should be available');
});

test('claude_code_cli configuration should have required settings', t => {
  const claudeConfig = smart_env_config.default_settings.smart_chat_model.claude_code_cli;
  
  t.truthy(claudeConfig, 'Should have claude_code_cli specific configuration');
  t.is(typeof claudeConfig.timeout, 'number', 'Should have timeout setting');
  t.is(typeof claudeConfig.max_retries, 'number', 'Should have max_retries setting');
  t.is(claudeConfig.model_key, 'claude-code-cli', 'Should have correct model_key');
});