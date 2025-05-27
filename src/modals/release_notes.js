import release_notes_md from '../../releases/3.0.0.md' with { type: 'markdown' };
import { Modal, MarkdownRenderer } from 'obsidian';

/**
 * @class ReleaseNotesModal
 * Displays release notes for the current version after upgrade.
 *
 * @param {SmartConnectionsPlugin} plugin
 * @param {string} version   – version string that triggered this modal
 */
export class ReleaseNotesModal extends Modal {
  constructor(plugin, version) {
    super(plugin.app);
    this.plugin = plugin;
    this.version = version;
  }

  async onOpen() {
    this.titleEl.setText(`What's new in v${this.version}`);

    // render markdown ▸ html
    await MarkdownRenderer.renderMarkdown(
      release_notes_md,
      this.contentEl,
      this.plugin.app.workspace.getActiveFile()?.path ?? '',
      this.plugin
    );
  }
}
