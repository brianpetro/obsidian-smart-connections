/**
 * @file connections_score_column.js
 * @description Adds a "Connections score" column to a Bases `.base` file by
 *              inserting the appropriate `formulas`, `display`, and ensuring it
 *              is the *first* entry in `views.order`.  Includes a
 *              FuzzySuggestModal for selecting a note whose similarity will be
 *              used by the `cos_sim` formula.
 */

import { FuzzySuggestModal, Notice } from 'obsidian';

export function insert_connections_score_column(baseStr, selectedKey, propertyName = '') {
  if (!baseStr || !selectedKey) return baseStr;

  const prop         = propertyName || selectedKey.split('/').pop().replace(/\.md$/i, '');
  const formulaLine  = `  ${prop}: cos_sim(file.file, \"${selectedKey}\")`;
  const displayLine  = `  formula.${prop}: ${prop}`;
  const orderLine    = `      - formula.${prop}`;

  const lines = baseStr.split(/\r?\n/);
  const blockEnd = (idx, indentRx) => { let i = idx + 1; while (i < lines.length && indentRx.test(lines[i])) i++; return i - 1; };

  // 1️⃣ formulas
  const f = lines.findIndex(l => /^formulas:\s*$/.test(l));
  if (f !== -1 && !lines.includes(formulaLine)) lines.splice(blockEnd(f, /^\s{2}\S/)+1, 0, formulaLine);

  // 2️⃣ display
  const d = lines.findIndex(l => /^display:\s*$/.test(l));
  if (d !== -1 && !lines.includes(displayLine)) lines.splice(blockEnd(d, /^\s{2}\S/)+1, 0, displayLine);

  // 3️⃣ views.order – insert as first list item
  const v = lines.findIndex(l => /^views:\s*$/.test(l));
  if (v !== -1 && !lines.includes(orderLine)) {
    let orderIdx = -1;
    for (let i = v + 1; i < lines.length; i++) {
      if (/^\s*-\s+type:\s+table/.test(lines[i])) {
        orderIdx = lines.findIndex((l, j) => j > i && /^\s+order:\s*$/.test(l));
        break;
      }
    }
    if (orderIdx !== -1) lines.splice(orderIdx + 1, 0, orderLine);
  }

  return lines.join('\n');
}

export class ConnectionsScoreColumnModal extends FuzzySuggestModal {
  constructor(app) {
    super(app);
    this.items = Object.keys(window.smart_env?.smart_sources?.items || {});
    this.setPlaceholder('Select note for similarity…');
  }
  getItems()        { return this.items; }
  getItemText(item) { return item; }
  onChooseItem(i)   { this.#apply(i); }

  async #apply(selectedKey) {
    const file = this.app.workspace.getActiveFile();
    if (!is_base_file(file)) { new Notice('No active .base file'); return; }

    const original = await this.app.vault.read(file);
    const updated  = insert_connections_score_column(original, selectedKey);
    if (original === updated) { new Notice('Connections score column already present'); return; }

    await this.app.vault.modify(file, updated);
    this.#reload_base();
    new Notice(`Added cos_sim column for ${selectedKey}`);
  }

  #reload_base() {
    this.app.workspace.getLeavesOfType('bases').forEach(leaf => {
      return leaf.isVisible() && leaf.rebuildView()
    });
  }
}

const is_base_file = file => !!file && file.extension === 'base';

export function register_connections_score_command(plugin) {
  plugin.addCommand({
    id:   'sc-add-connections-score-column',
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