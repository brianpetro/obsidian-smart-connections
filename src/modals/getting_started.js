import { Modal } from 'obsidian';

export class GettingStartedModal extends Modal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    this.titleEl.setText('Getting Started With Smart Connections');
    this.modalEl.addClass('sc-getting-started-modal');
    const container = this.contentEl.createEl('div', { cls: 'sc-getting-started-container' });
    const webview = container.createEl('webview', {
      attr: {
        src: 'https://smartconnections.app/story/smart-connections-getting-started/?utm_source=obsidian-modal',
        allowpopups: ''
      }
    });
    webview.style.width = '100%';
    webview.style.height = '100%';
  }

  onClose() {
    this.contentEl.empty();
  }
}