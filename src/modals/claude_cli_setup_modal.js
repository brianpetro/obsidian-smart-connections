/**
 * Claude Code CLI Setup Modal
 * Provides user-friendly setup guide for installing and configuring Claude Code CLI
 * Displays platform-specific instructions with progress tracking
 */

import { Modal, Platform } from 'obsidian';

export class ClaudeCliSetupModal extends Modal {
  constructor(app, plugin, options = {}) {
    super(app);
    this.plugin = plugin;
    this.availability = options.availability || { available: false };
    this.setupSteps = options.setupSteps || [];
    this.onComplete = options.onComplete || (() => {});
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    this.createHeader();
    this.createBenefitsSection();
    this.createInstructionsSection();
    this.createActionButtons();
  }

  createHeader() {
    const headerEl = this.contentEl.createDiv('setup-modal-header');
    
    // Title with icon
    const titleEl = headerEl.createDiv('setup-modal-title');
    titleEl.innerHTML = `
      <span class="setup-icon">🏠</span>
      <h2>Setup Local AI Processing</h2>
    `;
    
    // Subtitle
    const subtitleEl = headerEl.createDiv('setup-modal-subtitle');
    subtitleEl.textContent = 'Enable private, cost-free AI conversations with Claude Code CLI';
  }

  createBenefitsSection() {
    const benefitsEl = this.contentEl.createDiv('setup-benefits-section');
    benefitsEl.innerHTML = `
      <h3>Why Choose Local Processing?</h3>
      <div class="benefits-grid">
        <div class="benefit-item">
          <span class="benefit-icon">🔒</span>
          <div class="benefit-content">
            <h4>Complete Privacy</h4>
            <p>Your notes and conversations never leave your machine</p>
          </div>
        </div>
        <div class="benefit-item">
          <span class="benefit-icon">💰</span>
          <div class="benefit-content">
            <h4>No API Costs</h4>
            <p>Unlimited usage without subscription fees or token limits</p>
          </div>
        </div>
        <div class="benefit-item">
          <span class="benefit-icon">📡</span>
          <div class="benefit-content">
            <h4>Works Offline</h4>
            <p>No internet required after initial setup</p>
          </div>
        </div>
        <div class="benefit-item">
          <span class="benefit-icon">⚡</span>
          <div class="benefit-content">
            <h4>Fast & Reliable</h4>
            <p>Direct local processing without network delays</p>
          </div>
        </div>
      </div>
    `;
  }

  createInstructionsSection() {
    const instructionsEl = this.contentEl.createDiv('setup-instructions-section');
    
    // Get platform-specific instructions
    const instructions = this.getInstallationInstructions();
    
    instructionsEl.innerHTML = `
      <h3>${instructions.title}</h3>
      <div class="installation-steps">
        ${instructions.steps.map((step, index) => `
          <div class="installation-step">
            <span class="step-number">${index + 1}</span>
            <span class="step-text">${step}</span>
          </div>
        `).join('')}
      </div>
    `;

    // Add troubleshooting section
    const troubleshootingEl = instructionsEl.createDiv('troubleshooting-section');
    troubleshootingEl.innerHTML = `
      <details>
        <summary>Troubleshooting</summary>
        <div class="troubleshooting-content">
          <h4>Common Issues:</h4>
          <ul>
            <li><strong>Permission denied:</strong> Make sure to run the installer as Administrator (Windows) or with sudo (Linux/macOS)</li>
            <li><strong>Command not found:</strong> Restart your terminal/Obsidian after installation</li>
            <li><strong>Path issues:</strong> The installer should automatically add Claude CLI to your PATH</li>
          </ul>
          <h4>Still having issues?</h4>
          <p>Visit the <a href="https://docs.claude.ai/en/docs/claude-code" class="external-link">Claude Code documentation</a> for detailed troubleshooting.</p>
        </div>
      </details>
    `;
  }

  createActionButtons() {
    const actionsEl = this.contentEl.createDiv('setup-modal-actions');
    
    // Primary action button
    const downloadBtn = actionsEl.createEl('button', {
      text: 'Download Claude Code CLI',
      cls: 'mod-cta setup-primary-btn'
    });
    
    downloadBtn.addEventListener('click', () => {
      const instructions = this.getInstallationInstructions();
      window.open(instructions.downloadUrl, '_blank');
    });

    // Secondary actions
    const secondaryActionsEl = actionsEl.createDiv('setup-secondary-actions');
    
    // Test connection button
    const testBtn = secondaryActionsEl.createEl('button', {
      text: 'Test Connection',
      cls: 'setup-secondary-btn'
    });
    
    testBtn.addEventListener('click', async () => {
      await this.testConnection();
    });

    // Skip and use external API
    const skipBtn = secondaryActionsEl.createEl('button', {
      text: 'Skip - Use External API Instead',
      cls: 'setup-skip-btn'
    });
    
    skipBtn.addEventListener('click', () => {
      this.showExternalApiOption();
    });

    // Close button
    const closeBtn = secondaryActionsEl.createEl('button', {
      text: 'Close',
      cls: 'setup-close-btn'
    });
    
    closeBtn.addEventListener('click', () => {
      this.close();
    });
  }

  async testConnection() {
    const testBtn = this.contentEl.querySelector('.setup-secondary-btn');
    const originalText = testBtn.textContent;
    
    testBtn.textContent = 'Testing...';
    testBtn.disabled = true;
    
    try {
      const result = await this.plugin.first_run_manager.testConnection();
      
      if (result.success) {
        testBtn.textContent = '✅ Connection Successful';
        testBtn.style.background = '#4CAF50';
        testBtn.style.color = 'white';
        
        // Mark setup as complete and close modal
        setTimeout(async () => {
          await this.plugin.first_run_manager.markFirstRunComplete();
          this.onComplete(true);
          this.close();
        }, 1500);
      } else {
        testBtn.textContent = '❌ Connection Failed';
        testBtn.style.background = '#F44336';
        testBtn.style.color = 'white';
        
        // Show error details
        const errorEl = this.contentEl.createDiv('test-error');
        errorEl.textContent = `Error: ${result.error}`;
        errorEl.style.color = '#F44336';
        errorEl.style.marginTop = '10px';
        
        // Reset button after delay
        setTimeout(() => {
          testBtn.textContent = originalText;
          testBtn.style.background = '';
          testBtn.style.color = '';
          testBtn.disabled = false;
          errorEl.remove();
        }, 3000);
      }
    } catch (error) {
      testBtn.textContent = '❌ Test Failed';
      testBtn.style.background = '#F44336';
      
      setTimeout(() => {
        testBtn.textContent = originalText;
        testBtn.style.background = '';
        testBtn.disabled = false;
      }, 3000);
    }
  }

  showExternalApiOption() {
    const content = this.contentEl;
    content.empty();
    
    content.innerHTML = `
      <div class="external-api-option">
        <h2>Switch to External API</h2>
        <p>You can use external AI providers instead of local processing. This requires an API key and internet connection.</p>
        
        <div class="api-providers">
          <div class="provider-option" data-provider="openai">
            <h4>OpenAI</h4>
            <p>GPT-4, GPT-3.5-turbo models</p>
          </div>
          <div class="provider-option" data-provider="anthropic">
            <h4>Anthropic</h4>
            <p>Claude 3.5 Sonnet, Claude 3 models</p>
          </div>
        </div>
        
        <div class="external-api-actions">
          <button class="mod-cta" id="configure-external">Configure External API</button>
          <button id="back-to-local">Back to Local Setup</button>
        </div>
      </div>
    `;

    // Add event listeners
    content.querySelector('#configure-external').addEventListener('click', () => {
      // Open settings to configure external API
      this.app.setting.open();
      this.app.setting.openTabById('smart-connections');
      this.close();
    });

    content.querySelector('#back-to-local').addEventListener('click', () => {
      this.onOpen(); // Recreate the original modal
    });
  }

  getInstallationInstructions() {
    const platform = Platform.isMacOS ? 'darwin' : Platform.isWin ? 'win32' : 'linux';
    
    const instructions = {
      darwin: {
        title: 'Install on macOS',
        steps: [
          'Download Claude Code CLI from the official website',
          'Open the downloaded .dmg file',
          'Drag Claude Code CLI to your Applications folder',
          'Launch Terminal and verify installation with: <code>claude --version</code>',
          'Restart Obsidian to complete setup'
        ],
        downloadUrl: 'https://claude.ai/code'
      },
      win32: {
        title: 'Install on Windows',
        steps: [
          'Download Claude Code CLI installer from the official website',
          'Right-click the installer and select "Run as Administrator"',
          'Follow the installation wizard prompts',
          'Open Command Prompt and verify installation with: <code>claude --version</code>',
          'Restart Obsidian to complete setup'
        ],
        downloadUrl: 'https://claude.ai/code'
      },
      linux: {
        title: 'Install on Linux',
        steps: [
          'Download Claude Code CLI package from the official website',
          'Install using your package manager (e.g., <code>sudo dpkg -i claude-cli.deb</code>)',
          'Or extract and add to PATH manually if using tar.gz',
          'Open terminal and verify installation with: <code>claude --version</code>',
          'Restart Obsidian to complete setup'
        ],
        downloadUrl: 'https://claude.ai/code'
      }
    };

    return instructions[platform] || instructions.darwin;
  }

  onClose() {
    // Clean up any event listeners or resources
  }
}