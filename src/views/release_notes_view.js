/**
 * ReleaseNotesView
 * -----------------------------------------------------------------------------
 * Renders changelog markdown inside a normal Obsidian item‑view so that it
 * looks & feels just like reading a note.  The view occupies a root leaf by
 * default (same area as your notes) and autoscrolls to the section that matches
 * the installed plugin version.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  Smart Connections • Copyright 2025 Brian Petro  GPL‑3.0
 */

import { ItemView, MarkdownRenderer } from 'obsidian';
import release_notes_md from '../../releases/3.0.0.md' with { type: 'markdown' };

export class ReleaseNotesView extends ItemView {
  /* ─────────────────────────────── metadata ─────────────────────────────── */
  static get view_type()    { return 'smart-release-notes-view'; }
  static get display_text() { return 'Release Notes';           }
  static get icon_name()    { return 'file-text';               }

  /** Convenience helper – opens (or reveals) the view in a root leaf. */
  static open(workspace, version, active = true) {
    const leaf = workspace.getLeavesOfType(this.view_type)[0] ?? workspace.getLeaf(false);
    leaf.setViewState({ type: this.view_type, active, state: { version } });
  }

  /* ───────────────────────────── item‑view API ───────────────────────────── */
  getViewType()    { return ReleaseNotesView.view_type;    }
  getDisplayText() { return ReleaseNotesView.display_text; }
  getIcon()        { return ReleaseNotesView.icon_name;    }

  /**
   * Build the preview container & render markdown using core renderer so the
   * output styles match native note preview exactly.
   */
  onOpen() {

    this.titleEl.setText(`What’s new in v${this.version}`);
    this.render();
  }
  get container () {
    return this.containerEl?.querySelector('.view-content');
  }
  async render() {
    while (!this.container) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.warn('Waiting for containerEl to be ready...', this.container);
    }
    MarkdownRenderer.render(
      this.app,
      release_notes_md,
      this.container,
      '',
      this,
    );

    requestAnimationFrame(() => this.#scroll_to_version(this.container, this.version));
  }
  get version() {
    const version = this.leaf.viewState?.state?.version ??
      this.app.plugins.getPlugin('smart-connections')?.manifest.version ?? '';
    return version;
  }

  /* ────────────────────────────── utilities ─────────────────────────────── */
  #scroll_to_version(container, version) {
    if (!version) return;
    const safe = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matcher = new RegExp(`\\bv?${safe}\\b`, 'i');
    container.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(h => {
      if (matcher.test(h.textContent ?? '')) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}
