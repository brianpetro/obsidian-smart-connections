/**
 * @module components/tool_calls
 * @description Renders tool calls in a collapsible element
 */

/**
 * Builds the HTML string for the tool calls component
 * @param {SmartMessage} message - Message instance containing tool_calls
 * @param {Object} [opts={}] - Optional parameters for customizing the build
 * @returns {string} HTML string for the tool calls component
 */
export function build_html(message, opts = {}) {
  const tool_calls = message.tool_calls || [];

  if (tool_calls.length === 0) {
    return ''; // No tool calls to display
  }

  return `
    <div class="sc-tool-calls-container" id="${message.data.id}">
      ${tool_calls.map((tool_call, index) => `
        <div class="sc-tool-call">
          <div class="sc-tool-call-header" tabindex="0" role="button" aria-expanded="false" aria-controls="${message.data.id}-content">
            <span>${tool_call.function.name}</span>
            <span class="sc-tool-call-toggle-icon">${this.get_icon_html('chevron-down')}</span>
          </div>
          <div class="sc-tool-call-content" id="${message.data.id}-content" hidden>
            <pre><code class="language-json">${JSON.stringify((typeof tool_call.function.arguments === 'string') ? JSON.parse(tool_call.function.arguments) : tool_call.function.arguments, null, 2)}</code></pre>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Renders the tool calls component
 * @async
 * @param {SmartMessage} message - Message instance containing tool_calls
 * @param {Object} [opts={}] - Rendering options
 * @returns {Promise<DocumentFragment>} Rendered tool calls interface
 */
export async function render(message, opts = {}) {
  const html = build_html.call(this, message, opts);
  if (!html) return document.createDocumentFragment(); // Return empty fragment if no tool calls

  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, message, frag, opts);
}

/**
 * Post-processes the rendered tool calls component
 * @async
 * @param {SmartMessage} message - Message instance
 * @param {DocumentFragment} frag - Rendered fragment
 * @param {Object} opts - Processing options
 * @returns {Promise<DocumentFragment>} Post-processed fragment
 */
export async function post_process(message, frag, opts) {
  const tool_call_headers = frag.querySelectorAll('.sc-tool-call-header');

  tool_call_headers.forEach(header => {
    const content = header.nextElementSibling;
    const toggle_icon = header.querySelector('.sc-tool-call-toggle-icon');

    // Toggle visibility on header click
    header.addEventListener('click', () => {
      const is_expanded = header.getAttribute('aria-expanded') === 'true';
      
      if (is_expanded) {
        header.setAttribute('aria-expanded', 'false');
        content.hidden = true;
      } else {
        header.setAttribute('aria-expanded', 'true');
        content.hidden = false;
      }
    });

    // Add keyboard accessibility
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        header.click();
      }
    });
  });

  return frag;
}
