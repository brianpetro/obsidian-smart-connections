/**
 * Enhanced Model Settings Component for Local-First Experience
 * Provides conditional UI rendering based on adapter type
 * Emphasizes local processing benefits and simplifies Claude Code CLI settings
 */

/**
 * Determines if an adapter runs locally (no external API required)
 */
export function isLocalAdapter(adapter) {
  const localAdapters = ['claude_code_cli', 'ollama', 'lm_studio', 'custom'];
  return localAdapters.includes(adapter);
}

/**
 * Generates status indicator based on adapter type
 */
export function generateStatusIndicator(adapter) {
  if (isLocalAdapter(adapter)) {
    return {
      text: '🏠 Local Processing Active',
      class: 'local-processing-active',
      description: 'All AI processing happens on your machine - complete privacy, no usage costs',
      benefits: [
        'Complete privacy - your data never leaves your machine',
        'No usage costs or API limits',
        'Works offline',
        'No external accounts required'
      ]
    };
  }
  return {
    text: '🌐 External API Active', 
    class: 'external-api-active',
    description: 'AI processing uses external service - requires API key and internet connection',
    benefits: [
      'Access to latest models',
      'No local compute requirements',
      'Consistent performance'
    ]
  };
}

/**
 * Gets Claude Code CLI specific settings configuration
 */
export function getClaudeCodeCliSettings() {
  return {
    timeout: {
      name: 'Request Timeout',
      type: 'number',
      description: 'Maximum time to wait for Claude Code CLI response (milliseconds)',
      default: 60000,
      min: 5000,
      max: 300000,
      step: 1000
    },
    max_retries: {
      name: 'Maximum Retries',
      type: 'number',
      description: 'Number of retry attempts when Claude Code CLI fails',
      default: 3,
      min: 1,
      max: 5
    },
    context_limit: {
      name: 'Context Results Limit',
      type: 'number', 
      description: 'Maximum number of semantic search results to include as context',
      default: 5,
      min: 1,
      max: 20
    }
  };
}

/**
 * Determines which settings should be visible based on adapter type
 */
export function getVisibleSettings(adapter) {
  const baseSettings = ['adapter', 'model_key'];
  const localSettings = ['timeout', 'max_retries', 'context_limit'];
  const externalSettings = ['api_key', 'api_url', 'organization'];
  
  if (isLocalAdapter(adapter)) {
    return [...baseSettings, ...localSettings];
  }
  return [...baseSettings, ...externalSettings];
}

/**
 * Creates enhanced settings HTML with conditional rendering
 */
export function createEnhancedSettingsHTML(adapter, settings = {}) {
  const statusIndicator = generateStatusIndicator(adapter);
  const visibleSettings = getVisibleSettings(adapter);
  const isLocal = isLocalAdapter(adapter);
  
  let html = `
    <div class="smart-chat-model-settings">
      <!-- Status Indicator -->
      <div class="processing-status ${statusIndicator.class}">
        <div class="status-header">
          <span class="status-icon">${statusIndicator.text}</span>
        </div>
        <div class="status-description">
          ${statusIndicator.description}
        </div>
        <div class="status-benefits">
          <ul>
            ${statusIndicator.benefits.map(benefit => `<li>${benefit}</li>`).join('')}
          </ul>
        </div>
      </div>
      
      <!-- Adapter Selection -->
      <div class="setting-item adapter-selection">
        <div class="setting-name">AI Provider</div>
        <div class="setting-description">Choose your AI processing method</div>
        <select class="setting-input" data-setting="adapter">
          <option value="claude_code_cli" ${adapter === 'claude_code_cli' ? 'selected' : ''}>
            Claude Code CLI (Local, Private)
          </option>
          <option value="ollama" ${adapter === 'ollama' ? 'selected' : ''}>
            Ollama (Local)
          </option>
          <option value="lm_studio" ${adapter === 'lm_studio' ? 'selected' : ''}>
            LM Studio (Local)
          </option>
          <option value="openai" ${adapter === 'openai' ? 'selected' : ''}>
            OpenAI (External API)
          </option>
        </select>
      </div>
  `;

  // Claude Code CLI specific settings
  if (adapter === 'claude_code_cli') {
    const claudeSettings = getClaudeCodeCliSettings();
    html += `
      <div class="claude-code-cli-settings">
        <h3>Claude Code CLI Configuration</h3>
        <div class="setting-note">
          <strong>Note:</strong> Make sure you have Claude Code CLI installed. 
          <a href="#" class="install-guide-link">Installation guide</a>
        </div>
    `;
    
    Object.entries(claudeSettings).forEach(([key, config]) => {
      const value = settings[key] || config.default;
      html += `
        <div class="setting-item">
          <div class="setting-name">${config.name}</div>
          <div class="setting-description">${config.description}</div>
          <input 
            type="${config.type}" 
            class="setting-input" 
            data-setting="${key}"
            value="${value}"
            ${config.min ? `min="${config.min}"` : ''}
            ${config.max ? `max="${config.max}"` : ''}
            ${config.step ? `step="${config.step}"` : ''}
          />
        </div>
      `;
    });
    
    html += `</div>`;
  }

  // External API settings (hidden for local adapters)
  if (!isLocal) {
    html += `
      <div class="external-api-settings">
        <div class="setting-item api-key-field">
          <div class="setting-name">API Key</div>
          <div class="setting-description">Your API key for this service</div>
          <input 
            type="password" 
            class="setting-input" 
            data-setting="api_key"
            placeholder="Enter your API key"
          />
        </div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

/**
 * Main render function for enhanced model settings
 * Compatible with existing smart-model component interface
 */
export async function render(scope, opts = {}) {
  const adapter = scope?.settings?.adapter || 'claude_code_cli';
  const adapterSettings = scope?.settings?.[adapter] || {};
  
  const html = createEnhancedSettingsHTML(adapter, adapterSettings);
  const frag = this?.create_doc_fragment ? 
    this.create_doc_fragment(html) : 
    createDocumentFragment(html);
    
  return await addEventListeners(frag, scope);
}

/**
 * Creates document fragment from HTML string (fallback for test environment)
 */
function createDocumentFragment(html) {
  if (typeof document !== 'undefined') {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
  }
  // Mock for test environment
  return { innerHTML: html };
}

/**
 * Adds event listeners to the settings fragment
 */
async function addEventListeners(frag, scope) {
  // Adapter selection change
  const adapterSelect = frag.querySelector?.('[data-setting="adapter"]');
  if (adapterSelect) {
    adapterSelect.addEventListener('change', (e) => {
      const newAdapter = e.target.value;
      if (scope?.reload_model) {
        scope.reload_model();
      }
      if (scope?.re_render_settings) {
        scope.re_render_settings();
      }
    });
  }

  // Setting input changes
  const settingInputs = frag.querySelectorAll?.('[data-setting]') || [];
  settingInputs.forEach(input => {
    if (input.getAttribute('data-setting') === 'adapter') return; // Already handled
    
    input.addEventListener('change', (e) => {
      const setting = e.target.getAttribute('data-setting');
      const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
      
      // Update settings
      if (scope?.settings && scope.settings[scope.settings.adapter]) {
        scope.settings[scope.settings.adapter][setting] = value;
      }
    });
  });

  // Installation guide link
  const installGuideLink = frag.querySelector?.('.install-guide-link');
  if (installGuideLink) {
    installGuideLink.addEventListener('click', (e) => {
      e.preventDefault();
      // Open installation guide - could be implemented as modal or external link
      console.log('Open Claude Code CLI installation guide');
    });
  }

  return frag;
}