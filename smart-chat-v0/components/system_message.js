/**
 * @module components/system_message
 * @description Renders system messages with special styling and functionality
 */

/**
 * Builds the HTML string for the system message component
 * @param {SmartMessage} message - System message instance to render
 * @param {Object} [opts={}] - Optional parameters for customizing the build
 * @returns {string} HTML string for the system message
 */
export function build_html(message, opts = {}) {
  return `
    <div class="sc-system-message-container" id="${message.data.id}">
      <div class="sc-system-message-header" tabindex="0" role="button" aria-expanded="false" aria-controls="${message.data.id}-content">
        <span>${this.get_icon_html('settings')} System Message</span>
        <span class="sc-system-message-toggle-icon">${this.get_icon_html('chevron-down')}</span>
      </div>
      <div class="sc-system-message-content" id="${message.data.id}-content" hidden>
        <div class="sc-system-message-text">
          <pre>${message.content.map(part => part.text || part.input?.key).join('\n')}</pre>
        </div>
        <button class="sc-system-message-copy" title="Copy system message">
          ${this.get_icon_html('copy')}
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders a system message
 * @async
 * @param {SmartMessage} message - System message instance to render
 * @param {Object} [opts={}] - Rendering options
 * @returns {Promise<DocumentFragment>} Rendered system message interface
 */
export async function render(message, opts = {}) {
  const html = build_html.call(this, message, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, message, frag, opts);
}

/**
 * Post-processes the rendered system message
 * @async
 * @param {SmartMessage} message - System message instance
 * @param {DocumentFragment} frag - Rendered fragment
 * @param {Object} opts - Processing options
 * @returns {Promise<DocumentFragment>} Post-processed fragment
 */
export async function post_process(message, frag, opts) {
  const header = frag.querySelector('.sc-system-message-header');
  const content = frag.querySelector('.sc-system-message-content');
  const toggle_icon = frag.querySelector('.sc-system-message-toggle-icon');
  const copy_button = frag.querySelector('.sc-system-message-copy');
  const text_container = frag.querySelector('.sc-system-message-text');

  if (header && content && toggle_icon) {
    // Toggle visibility on header click
    header.addEventListener('click', () => {
      const is_expanded = header.getAttribute('aria-expanded') === 'true';
      header.setAttribute('aria-expanded', !is_expanded);
      content.hidden = is_expanded;
      
      // Rotate chevron icon
      toggle_icon.style.transform = is_expanded ? '' : 'rotate(180deg)';
    });
  }

  if (copy_button && text_container) {
    copy_button.addEventListener('click', () => {
      navigator.clipboard.writeText(text_container.textContent)
        .then(() => {
          // Visual feedback for copy success
          copy_button.classList.add('sc-copied');
          setTimeout(() => {
            copy_button.classList.remove('sc-copied');
          }, 1000);
        })
        .catch(err => {
          console.error('Failed to copy system message:', err);
        });
    });
  }

  // If the content is markdown, render it
  if (text_container && typeof message.content === 'string') {
    const markdown_rendered_frag = await this.render_markdown(message.content, message);
    this.empty(text_container);
    text_container.appendChild(markdown_rendered_frag);
  }

  return frag;
}
