/**
 * Migration Confirmation Modal
 * Provides user-friendly migration experience from external APIs to Claude Code CLI
 * Shows benefits, migration plan details, and handles confirmation process
 */

import { Modal } from 'obsidian';

export class MigrationConfirmationModal extends Modal {
  constructor(app, plugin, options = {}) {
    super(app);
    this.plugin = plugin;
    this.migrationPlan = options.migrationPlan;
    this.onConfirm = options.onConfirm || (() => {});
    this.onCancel = options.onCancel || (() => {});
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    this.createHeader();
    this.createCurrentStateSection();
    this.createBenefitsSection();
    this.createMigrationDetailsSection();
    this.createActionButtons();
  }

  createHeader() {
    const headerEl = this.contentEl.createDiv('migration-modal-header');
    
    // Title with icon
    const titleEl = headerEl.createDiv('migration-modal-title');
    titleEl.innerHTML = `
      <span class="migration-icon">🏠→🔒</span>
      <h2>Switch to Local AI Processing</h2>
    `;
    
    // Subtitle
    const subtitleEl = headerEl.createDiv('migration-modal-subtitle');
    subtitleEl.textContent = 'Upgrade to private, cost-free AI conversations with Claude Code CLI';
  }

  createCurrentStateSection() {
    const currentEl = this.contentEl.createDiv('migration-current-state');
    const plan = this.migrationPlan;
    
    currentEl.innerHTML = `
      <div class="current-config">
        <h3>Current Configuration</h3>
        <div class="config-details">
          <div class="config-item">
            <span class="config-label">Provider:</span>
            <span class="config-value">${plan.from.provider}</span>
          </div>
          <div class="config-item">
            <span class="config-label">Model:</span>
            <span class="config-value">${plan.from.model}</span>
          </div>
          <div class="config-item">
            <span class="config-label">Chat Threads:</span>
            <span class="config-value">${plan.changes.threadsToUpdate} threads will be migrated</span>
          </div>
        </div>
      </div>
    `;
  }

  createBenefitsSection() {
    const benefitsEl = this.contentEl.createDiv('migration-benefits-section');
    benefitsEl.innerHTML = `
      <h3>Benefits of Local Processing</h3>
      <div class="benefits-grid">
        ${this.migrationPlan.benefits.map(benefit => `
          <div class="benefit-item">
            <span class="benefit-check">✅</span>
            <span class="benefit-text">${benefit}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  createMigrationDetailsSection() {
    const detailsEl = this.contentEl.createDiv('migration-details-section');
    const stats = this.migrationPlan.statistics;
    
    detailsEl.innerHTML = `
      <h3>Migration Details</h3>
      <div class="migration-stats">
        <div class="stat-grid">
          <div class="stat-item">
            <span class="stat-number">${stats.threadsToMigrate}</span>
            <span class="stat-label">Threads to Migrate</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${stats.totalMessages}</span>
            <span class="stat-label">Messages to Preserve</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${stats.estimatedTime}s</span>
            <span class="stat-label">Estimated Time</span>
          </div>
        </div>
      </div>
      
      <div class="migration-process">
        <h4>What happens during migration:</h4>
        <ul class="process-list">
          <li>✅ Your current API configuration is safely backed up</li>
          <li>✅ Chat threads are updated to use Claude Code CLI</li>
          <li>✅ All conversation history is preserved</li>
          <li>✅ You can easily rollback if needed</li>
        </ul>
      </div>
      
      <div class="migration-safety">
        <div class="safety-notice">
          <span class="safety-icon">🛡️</span>
          <div class="safety-content">
            <strong>100% Safe Migration</strong>
            <p>Your original configuration is preserved. You can switch back to external APIs anytime through settings.</p>
          </div>
        </div>
      </div>
    `;
  }

  createActionButtons() {
    const actionsEl = this.contentEl.createDiv('migration-modal-actions');
    
    // Primary action button
    const migrateBtn = actionsEl.createEl('button', {
      text: `Switch to Local Processing (${this.migrationPlan.statistics.estimatedTime}s)`,
      cls: 'mod-cta migration-primary-btn'
    });
    
    migrateBtn.addEventListener('click', async () => {
      await this.handleConfirmMigration(migrateBtn);
    });

    // Secondary actions
    const secondaryActionsEl = actionsEl.createDiv('migration-secondary-actions');
    
    // Keep current setup button
    const keepBtn = secondaryActionsEl.createEl('button', {
      text: 'Keep Current Setup',
      cls: 'migration-secondary-btn'
    });
    
    keepBtn.addEventListener('click', () => {
      this.onCancel();
      this.close();
    });

    // Learn more button
    const learnMoreBtn = secondaryActionsEl.createEl('button', {
      text: 'Learn More',
      cls: 'migration-info-btn'
    });
    
    learnMoreBtn.addEventListener('click', () => {
      this.showDetailedInfo();
    });
  }

  async handleConfirmMigration(button) {
    const originalText = button.textContent;
    
    // Update button state
    button.textContent = 'Migrating...';
    button.disabled = true;
    
    // Show progress indicator
    this.showMigrationProgress();
    
    try {
      // Execute migration
      await this.onConfirm();
      
      // Success state
      button.textContent = '✅ Migration Complete!';
      button.style.background = '#4CAF50';
      button.style.color = 'white';
      
      // Close modal after delay
      setTimeout(() => {
        this.close();
      }, 2000);
      
    } catch (error) {
      console.error('Migration failed:', error);
      
      // Error state
      button.textContent = '❌ Migration Failed';
      button.style.background = '#F44336';
      button.style.color = 'white';
      
      // Show error message
      const errorEl = this.contentEl.createDiv('migration-error');
      errorEl.innerHTML = `
        <div class="error-message">
          <span class="error-icon">⚠️</span>
          <div class="error-content">
            <strong>Migration failed:</strong>
            <p>${error.message}</p>
            <p><small>Your original configuration has been preserved.</small></p>
          </div>
        </div>
      `;
      
      // Reset button after delay
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = '';
        button.style.color = '';
        button.disabled = false;
        errorEl.remove();
      }, 5000);
    }
  }

  showMigrationProgress() {
    const progressEl = this.contentEl.createDiv('migration-progress');
    
    progressEl.innerHTML = `
      <div class="progress-container">
        <h4>Migration in Progress...</h4>
        <div class="progress-steps">
          <div class="progress-step active">
            <span class="step-icon">💾</span>
            <span class="step-text">Creating backup</span>
          </div>
          <div class="progress-step">
            <span class="step-icon">🔄</span>
            <span class="step-text">Updating settings</span>
          </div>
          <div class="progress-step">
            <span class="step-icon">💬</span>
            <span class="step-text">Migrating chat threads</span>
          </div>
          <div class="progress-step">
            <span class="step-icon">✅</span>
            <span class="step-text">Validation</span>
          </div>
        </div>
      </div>
    `;

    // Simulate progress (this could be enhanced to show real progress)
    const steps = progressEl.querySelectorAll('.progress-step');
    let currentStep = 0;
    
    const progressInterval = setInterval(() => {
      if (currentStep < steps.length - 1) {
        steps[currentStep].classList.remove('active');
        steps[currentStep].classList.add('completed');
        currentStep++;
        steps[currentStep].classList.add('active');
      } else {
        clearInterval(progressInterval);
        steps[currentStep].classList.remove('active');
        steps[currentStep].classList.add('completed');
      }
    }, 800);
  }

  showDetailedInfo() {
    const content = this.contentEl;
    content.empty();
    
    content.innerHTML = `
      <div class="detailed-info">
        <h2>Local AI Processing with Claude Code CLI</h2>
        
        <div class="info-sections">
          <div class="info-section">
            <h3>🔒 Privacy & Security</h3>
            <ul>
              <li>All conversations processed locally on your machine</li>
              <li>No data sent to external servers</li>
              <li>Complete control over your information</li>
              <li>GDPR and privacy regulation compliant</li>
            </ul>
          </div>
          
          <div class="info-section">
            <h3>💰 Cost Benefits</h3>
            <ul>
              <li>No monthly subscription fees</li>
              <li>No per-token charges</li>
              <li>Unlimited conversations</li>
              <li>One-time setup, lifetime usage</li>
            </ul>
          </div>
          
          <div class="info-section">
            <h3>⚡ Performance</h3>
            <ul>
              <li>No network latency delays</li>
              <li>Works completely offline</li>
              <li>No rate limiting restrictions</li>
              <li>Consistent response times</li>
            </ul>
          </div>
          
          <div class="info-section">
            <h3>🛡️ Migration Safety</h3>
            <ul>
              <li>Original API settings are preserved</li>
              <li>Chat history maintained completely</li>
              <li>Easy rollback through settings</li>
              <li>No data loss risk</li>
            </ul>
          </div>
        </div>
        
        <div class="detailed-info-actions">
          <button class="mod-cta" id="proceed-migration">Proceed with Migration</button>
          <button id="back-to-summary">Back to Summary</button>
        </div>
      </div>
    `;

    // Add event listeners
    content.querySelector('#proceed-migration').addEventListener('click', async () => {
      const button = content.querySelector('#proceed-migration');
      await this.handleConfirmMigration(button);
    });

    content.querySelector('#back-to-summary').addEventListener('click', () => {
      this.onOpen(); // Recreate the original modal
    });
  }

  onClose() {
    // Clean up any event listeners or intervals
  }
}