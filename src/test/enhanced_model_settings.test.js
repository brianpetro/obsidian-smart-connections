import test from 'ava';
import { 
  isLocalAdapter, 
  generateStatusIndicator,
  getClaudeCodeCliSettings,
  getVisibleSettings,
  createEnhancedSettingsHTML
} from '../components/enhanced_model_settings.js';

test('isLocalAdapter correctly identifies local adapters', t => {
  t.true(isLocalAdapter('claude_code_cli'));
  t.true(isLocalAdapter('ollama'));
  t.true(isLocalAdapter('lm_studio'));
  t.true(isLocalAdapter('custom'));
  t.false(isLocalAdapter('openai'));
  t.false(isLocalAdapter('anthropic'));
  t.false(isLocalAdapter('google'));
});

test('generateStatusIndicator creates correct indicators', t => {
  const localStatus = generateStatusIndicator('claude_code_cli');
  const externalStatus = generateStatusIndicator('openai');

  t.is(localStatus.text, '🏠 Local Processing Active');
  t.is(localStatus.class, 'local-processing-active');
  t.truthy(localStatus.benefits);
  t.true(Array.isArray(localStatus.benefits));
  t.true(localStatus.benefits.length > 0);
  
  t.is(externalStatus.text, '🌐 External API Active');
  t.is(externalStatus.class, 'external-api-active');
  t.truthy(externalStatus.benefits);
});

test('getClaudeCodeCliSettings returns correct configuration', t => {
  const settings = getClaudeCodeCliSettings();
  
  t.truthy(settings.timeout);
  t.truthy(settings.max_retries);
  t.truthy(settings.context_limit);
  
  t.is(settings.timeout.name, 'Request Timeout');
  t.is(settings.timeout.type, 'number');
  t.is(settings.timeout.default, 60000);
  
  t.is(settings.max_retries.default, 3);
  t.is(settings.context_limit.default, 5);
});

test('getVisibleSettings returns appropriate settings for adapter types', t => {
  const localSettings = getVisibleSettings('claude_code_cli');
  const externalSettings = getVisibleSettings('openai');
  
  t.true(localSettings.includes('adapter'));
  t.true(localSettings.includes('timeout'));
  t.true(localSettings.includes('max_retries'));
  t.true(localSettings.includes('context_limit'));
  t.false(localSettings.includes('api_key'));
  
  t.true(externalSettings.includes('adapter'));
  t.true(externalSettings.includes('api_key'));
  t.false(externalSettings.includes('timeout'));
});

test('createEnhancedSettingsHTML generates proper HTML structure', t => {
  const html = createEnhancedSettingsHTML('claude_code_cli');
  
  t.true(html.includes('smart-chat-model-settings'));
  t.true(html.includes('local-processing-active'));
  t.true(html.includes('🏠 Local Processing Active'));
  t.true(html.includes('claude-code-cli-settings'));
  t.true(html.includes('Claude Code CLI Configuration'));
  t.true(html.includes('Request Timeout'));
  t.false(html.includes('api-key-field'));
});

test('createEnhancedSettingsHTML generates external API HTML', t => {
  const html = createEnhancedSettingsHTML('openai');
  
  t.true(html.includes('external-api-active'));
  t.true(html.includes('🌐 External API Active'));
  t.true(html.includes('api-key-field'));
  t.false(html.includes('claude-code-cli-settings'));
});

test('createEnhancedSettingsHTML includes adapter selection', t => {
  const html = createEnhancedSettingsHTML('claude_code_cli');
  
  t.true(html.includes('adapter-selection'));
  t.true(html.includes('Claude Code CLI (Local, Private)'));
  t.true(html.includes('Ollama (Local)'));
  t.true(html.includes('OpenAI (External API)'));
  t.true(html.includes('selected'));
});

test('createEnhancedSettingsHTML applies current settings values', t => {
  const settings = {
    timeout: 30000,
    max_retries: 5,
    context_limit: 10
  };
  
  const html = createEnhancedSettingsHTML('claude_code_cli', settings);
  
  t.true(html.includes('value="30000"'));
  t.true(html.includes('value="5"'));
  t.true(html.includes('value="10"'));
});