import { Modal, Platform } from 'obsidian';
import { open_url_externally } from 'obsidian-smart-env/utils/open_url_externally.js';

export class StoryModal extends Modal {
  constructor(plugin, {title, url}) {
    super(plugin.app);
    this.plugin = plugin;
    this.title = title;
    this.url = url;
  }

  static open(plugin, story_url) {
    const modal = new StoryModal(plugin, story_url);
    modal.open();
  }

  onOpen() {
    this.titleEl.setText(this.title);
    this.modalEl.addClass('sc-story-modal');

    if (Platform.isMobile) {
      open_url_externally(this.plugin, this.url);
      this.close();
      return; // nothing else to render on mobile
    }

    const container = this.contentEl.createEl('div', {
      cls: 'sc-story-container',
    });

    const webview = container.createEl('webview', {
      attr: { src: this.url, allowpopups: '' },
    });
    webview.style.width = '100%';
    webview.style.height = '100%';
  }

  onClose() {
    this.contentEl.empty();
  }
}
