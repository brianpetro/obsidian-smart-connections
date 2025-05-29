import { FuzzySuggestModal, Notice } from 'obsidian';
import { is_base_file, insert_connections_score_column } from './connections_score_column.js';

export class ConnectionsScoreColumnModal extends FuzzySuggestModal {
  constructor(app) {
    super(app);
    this.items = [
      'Current/active file (dynamic)',
      ...Object.keys(window.smart_env?.smart_sources?.items || {})
    ];
    this.setPlaceholder('Select note for similarity…');
  }
  getItems() { return this.items; }
  getItemText(item) { return item; }
  onChooseItem(i) { this.#apply(i); }

  async #apply(selected_key) {
    const file = this.app.workspace.getActiveFile();
    if (!is_base_file(file)) { new Notice('No active .base file'); return; }
    let property_name;
    if (selected_key === 'Current/active file (dynamic)') {
      selected_key = "this.file.file";
      property_name = 'score';
    }
    const original = await this.app.vault.read(file);
    const updated = insert_connections_score_column(original, selected_key, property_name);
    if (original === updated) { new Notice('Connections score column already present'); return; }

    await this.app.vault.modify(file, updated);
    this.#reload_base();
    new Notice(`Added cos_sim column for ${selected_key}`);
  }

  #reload_base() {
    this.app.workspace.getLeavesOfType('bases')
      .forEach(leaf => leaf.isVisible() && leaf.rebuildView());
  }
}
/**
 * Register the command with Obsidian’s command palette.
 * @param {import('obsidian').Plugin} plugin
 */

export function register_connections_score_command(plugin) {
  plugin.addCommand({
    id: 'sc-add-connections-score-column',
    name: 'Add: Connections score base column',
    checkCallback: (checking) => {
      const ok = is_base_file(plugin.app.workspace.getActiveFile());
      if (checking) return ok;
      if (!ok) return false;
      new ConnectionsScoreColumnModal(plugin.app).open();
      return true;
    }
  });
}

