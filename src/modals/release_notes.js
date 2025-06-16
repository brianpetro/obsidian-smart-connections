import release_notes_md from '../../releases/3.0.0.md' with { type: 'markdown' };
import { Modal, MarkdownRenderer } from 'obsidian';

/**
 * ReleaseNotesModal
 * ------------------------------------------------------------------
 * Presents the markdown changelog inside a modal and automatically
 * scrolls to the section that corresponds with `version`.
 *
 * @class
 * @param {SmartConnectionsPlugin} plugin – plugin instance
 * @param {string}                 version – semver such as “3.0.34”
 */
export class ReleaseNotesModal extends Modal {
  constructor(plugin, version) {
    super(plugin.app);
    this.plugin = plugin;
    this.version = version;
  }

  /**
   * Render markdown → HTML, then scroll to the heading that contains
   * the current version string.  Runs after the modal is attached to
   * the DOM so that `scrollIntoView()` works reliably.
   *
   * @returns {Promise<void>}
   */
  async onOpen() {
    this.titleEl.setText(`What's new in v${this.version}`);

    await MarkdownRenderer.renderMarkdown(
      release_notes_md,
      this.contentEl,
      this.plugin.app.workspace.getActiveFile()?.path ?? '',
      this.plugin,
    );

    // Delay a tick to ensure layout & scroll height are final
    requestAnimationFrame(() => auto_scroll_to_version(this.contentEl, this.version));
  }
}

/**
 * Finds the first heading element whose text contains the supplied
 * semver and scrolls it into view.
 *
 * @param {HTMLElement} container – rendered markdown root element
 * @param {string}      version   – e.g. “3.0.34”
 */
function auto_scroll_to_version(container, version) {
  const safe = escape_regex(version);
  const matcher = new RegExp(`\\bv?${safe}\\b`, 'i');

  /** @type {NodeListOf<HTMLElement>} */
  const headings = container.querySelectorAll('h1,h2,h3,h4,h5,h6');

  for (const h of headings) {
    if (matcher.test(h.textContent ?? '')) {
      h.scrollIntoView({ block: 'start', behavior: 'auto' });
      return;
    }
  }
}

/**
 * Escapes special characters so a literal string can be used inside
 * a dynamic `RegExp` constructor.
 *
 * @param   {string} str
 * @returns {string}
 */
function escape_regex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}