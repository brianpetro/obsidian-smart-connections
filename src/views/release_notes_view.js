import { ItemView, MarkdownRenderer } from 'obsidian';
import { SmartItemView } from 'obsidian-smart-env/views/smart_item_view.js';
import release_notes_md from '../../releases/latest_release.md' with { type: 'markdown' };

export class ReleaseNotesView extends SmartItemView {
  static get view_type()    { return 'smart-release-notes-view'; }
  static get display_text() { return 'Release Notes';           }
  static get icon_name()    { return 'file-text';               }

  static open(workspace, version, active = true) {
    const leaf = workspace.getLeaf('tab'); // always open in a new tab
    leaf.setViewState({ type: this.view_type, active, state: { version } });
  }

  /* ───────────────────────────── item-view API ───────────────────────────── */
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
    const content = this.containerEl?.querySelector('.view-content');
    let preview = content?.querySelector('.markdown-preview-view');
    if(!preview) {
      const main = content?.createDiv('cm-scroller is-readable-line-width');
      preview = main?.createDiv('markdown-preview-view markdown-rendered');
    }
    return preview;
  }
  async render() {
    while (!this.container) {
      await new Promise(resolve => setTimeout(resolve, 100));
      console.warn('Waiting for containerEl to be ready...', this.container);
    }
    await MarkdownRenderer.render(
      this.app,
      release_notes_md,
      this.container,
      '',
      this,
    );

    // add target="_external" to links in container
    this.container.querySelectorAll('a').forEach(a => {
      a.setAttribute('target', '_external');
    });

    requestAnimationFrame(() => this.#scroll_to_version(this.container, this.version));
  }
  get version() {
    const version = this.leaf.viewState?.state?.version ??
      this.app.plugins.getPlugin('smart-connections')?.manifest.version ?? '';
    return version;
  }

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
