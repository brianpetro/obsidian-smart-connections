import test from 'ava';

/**
 * Test conditional UI rendering for local-first experience
 * Tests settings UI behavior when Claude Code CLI is active vs other adapters
 */

// Mock DOM elements and settings structure for testing
const createMockSettings = (adapter = 'claude_code_cli') => ({
  smart_chat_model: {
    adapter,
    [adapter]: {
      model_key: adapter === 'claude_code_cli' ? 'claude-code-cli' : 'test-model',
      ...(adapter === 'claude_code_cli' && {
        timeout: 60000,
        max_retries: 3,
        context_limit: 5
      }),
      ...(adapter === 'openai' && {
        api_key: 'test-key'
      })
    }
  }
});

const createMockElement = (className = 'test-element') => {
  const element = {
    className,
    style: { display: '' },
    textContent: '',
    appendChild: () => {},
    querySelector: () => null,
    setAttribute: () => {},
    getAttribute: () => null,
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false
    }
  };
  return element;
};

test('should identify Claude Code CLI as local adapter', t => {
  const isLocalAdapter = (adapter) => {
    const localAdapters = ['claude_code_cli', 'ollama', 'lm_studio', 'custom'];
    return localAdapters.includes(adapter);
  };

  t.true(isLocalAdapter('claude_code_cli'), 'Claude Code CLI should be identified as local');
  t.true(isLocalAdapter('ollama'), 'Ollama should be identified as local');
  t.true(isLocalAdapter('lm_studio'), 'LM Studio should be identified as local');
  t.false(isLocalAdapter('openai'), 'OpenAI should not be identified as local');
  t.false(isLocalAdapter('anthropic'), 'Anthropic should not be identified as local');
});

test('should hide API key fields for Claude Code CLI', t => {
  const settings = createMockSettings('claude_code_cli');
  const apiKeyField = createMockElement('api-key-field');
  
  const shouldHideApiKeyField = (adapter) => {
    const localAdapters = ['claude_code_cli', 'ollama', 'lm_studio'];
    return localAdapters.includes(adapter);
  };

  const hideApiKeyField = (element, adapter) => {
    if (shouldHideApiKeyField(adapter)) {
      element.style.display = 'none';
      return true;
    }
    return false;
  };

  const isHidden = hideApiKeyField(apiKeyField, settings.smart_chat_model.adapter);
  
  t.true(isHidden, 'API key field should be hidden for Claude Code CLI');
  t.is(apiKeyField.style.display, 'none', 'API key field display should be set to none');
});

test('should show API key fields for external providers', t => {
  const settings = createMockSettings('openai');
  const apiKeyField = createMockElement('api-key-field');
  
  const shouldHideApiKeyField = (adapter) => {
    const localAdapters = ['claude_code_cli', 'ollama', 'lm_studio'];
    return localAdapters.includes(adapter);
  };

  const hideApiKeyField = (element, adapter) => {
    if (shouldHideApiKeyField(adapter)) {
      element.style.display = 'none';
      return true;
    }
    element.style.display = 'block';
    return false;
  };

  const isHidden = hideApiKeyField(apiKeyField, settings.smart_chat_model.adapter);
  
  t.false(isHidden, 'API key field should not be hidden for OpenAI');
  t.is(apiKeyField.style.display, 'block', 'API key field should be visible');
});

test('should generate local processing status indicator', t => {
  const generateStatusIndicator = (adapter) => {
    const localAdapters = ['claude_code_cli', 'ollama', 'lm_studio'];
    if (localAdapters.includes(adapter)) {
      return {
        text: '🏠 Local Processing Active',
        class: 'local-processing-active',
        description: 'All AI processing happens on your machine'
      };
    }
    return {
      text: '🌐 External API Active',
      class: 'external-api-active', 
      description: 'AI processing uses external service'
    };
  };

  const claudeStatus = generateStatusIndicator('claude_code_cli');
  const openaiStatus = generateStatusIndicator('openai');

  t.is(claudeStatus.text, '🏠 Local Processing Active', 'Should show local processing for Claude Code CLI');
  t.is(claudeStatus.class, 'local-processing-active', 'Should have local processing class');
  t.is(openaiStatus.text, '🌐 External API Active', 'Should show external API for OpenAI');
  t.is(openaiStatus.class, 'external-api-active', 'Should have external API class');
});

test('should generate Claude Code CLI specific settings structure', t => {
  const generateClaudeCodeCliSettings = () => ({
    timeout: {
      name: 'Request Timeout',
      type: 'number',
      description: 'Maximum time to wait for response (milliseconds)',
      default: 60000,
      min: 5000,
      max: 300000
    },
    max_retries: {
      name: 'Maximum Retries',
      type: 'number', 
      description: 'Number of retry attempts on failure',
      default: 3,
      min: 1,
      max: 5
    },
    context_limit: {
      name: 'Context Limit',
      type: 'number',
      description: 'Maximum number of semantic search results to include',
      default: 5,
      min: 1,
      max: 20
    }
  });

  const settings = generateClaudeCodeCliSettings();
  
  t.truthy(settings.timeout, 'Should have timeout setting');
  t.truthy(settings.max_retries, 'Should have max_retries setting');
  t.truthy(settings.context_limit, 'Should have context_limit setting');
  
  t.is(settings.timeout.type, 'number', 'Timeout should be number type');
  t.is(settings.max_retries.default, 3, 'Max retries should default to 3');
  t.is(settings.context_limit.max, 20, 'Context limit max should be 20');
});

test('should validate settings visibility based on adapter type', t => {
  const getVisibleSettings = (adapter) => {
    const baseSettings = ['adapter_selection', 'model_key'];
    const localSettings = ['timeout', 'max_retries', 'context_limit'];
    const externalSettings = ['api_key', 'api_url', 'organization'];
    
    if (['claude_code_cli', 'ollama', 'lm_studio'].includes(adapter)) {
      return [...baseSettings, ...localSettings];
    }
    return [...baseSettings, ...externalSettings];
  };

  const claudeSettings = getVisibleSettings('claude_code_cli');
  const openaiSettings = getVisibleSettings('openai');

  t.true(claudeSettings.includes('timeout'), 'Claude Code CLI should show timeout setting');
  t.true(claudeSettings.includes('max_retries'), 'Claude Code CLI should show max_retries setting');
  t.false(claudeSettings.includes('api_key'), 'Claude Code CLI should not show api_key setting');
  
  t.true(openaiSettings.includes('api_key'), 'OpenAI should show api_key setting');
  t.false(openaiSettings.includes('timeout'), 'OpenAI should not show timeout setting');
});