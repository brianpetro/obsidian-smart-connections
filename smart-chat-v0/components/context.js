// renders collapsible element that lists items in message.context.lookup_results
// message item is provided as the scope for this component

// components/context.js

// ... (existing comments and imports)

/**
 * Builds the HTML string for the context component.
 * @param {SmartMessage} message - The message instance containing context.lookup_results.
 * @param {Object} [opts={}] - Optional parameters for customizing the build.
 * @returns {string} HTML string for the context component.
 */
export function build_html(message, opts = {}) {
  const lookup_results = message.tool_call_output || [];

  if (lookup_results.length === 0) {
    return ''; // No context to display
  }

  const review_context = message.settings?.review_context === true;

  return `
    <div class="sc-context-container" id="${message.data.id}">
      <div class="sc-context-header" tabindex="0" role="button" aria-expanded="false" aria-controls="context-list-${message.data.id}">
        <span>${this.get_icon_html('info')} Context (${lookup_results.length})</span>
        <span class="sc-context-toggle-icon">${this.get_icon_html('chevron-down')}</span>
      </div>
      <ul class="sc-context-list" id="context-list-${message.data.id}" hidden>
        ${lookup_results.map((result, index) => `
          <li class="sc-context-item" data-index="${index}">
            ${review_context ? `<button class="sc-context-remove-btn" title="Remove">${this.get_icon_html('x')}</button>` : ''}
            <span class="sc-context-item-path">${result.key}</span>
            <span class="sc-context-item-score">Score: ${result.score.toFixed(2)}</span>
          </li>
        `).join('')}
        ${review_context ? `
          <li class="sc-context-submit">
            <button class="sc-context-submit-btn">Submit</button>
          </li>
        ` : ''}
      </ul>
    </div>
  `;
}

/**
 * Renders the context component.
 * @async
 * @param {SmartMessage} message - The message instance containing context.lookup_results.
 * @param {Object} [opts={}] - Rendering options.
 * @returns {Promise<DocumentFragment>} Rendered context interface.
 */
export async function render(message, opts = {}) {
  const html = build_html.call(this, message, opts);
  if (!html) return document.createDocumentFragment(); // Return empty fragment if no context

  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, message, frag, opts);
}

/**
 * Post-processes the rendered context component.
 * @async
 * @param {SmartMessage} message - The message instance.
 * @param {DocumentFragment} frag - Rendered fragment.
 * @param {Object} opts - Processing options.
 * @returns {Promise<DocumentFragment>} Post-processed fragment.
 */
export async function post_process(message, frag, opts) {
  const header = frag.querySelector('.sc-context-header');
  const list = frag.querySelector('.sc-context-list');
  const toggle_icon = frag.querySelector('.sc-context-toggle-icon');
  const review_context = message.settings?.review_context === true;

  if (header && list && toggle_icon) {
    // Initialize collapsed state
    if(review_context) header.setAttribute('aria-expanded', 'true');
    else header.setAttribute('aria-expanded', 'false');

    // Toggle visibility on header click
    header.addEventListener('click', () => {
      const is_expanded = header.getAttribute('aria-expanded') === 'true';
      if (is_expanded) {
        header.setAttribute('aria-expanded', 'false');
      } else {
        header.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (review_context) {
    // Handle "x" button clicks to remove context items
    const remove_buttons = frag.querySelectorAll('.sc-context-remove-btn');
    remove_buttons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent collapsing the list
        const item = btn.closest('.sc-context-item');
        const index = parseInt(item.getAttribute('data-index'), 10);

        // Remove the context item from message.context.lookup_results
        message.tool_call_output.splice(index, 1);

        // Re-render the context component
        message.render();
      });
    });

    // Handle submit button click
    const submit_button = frag.querySelector('.sc-context-submit-btn');
    if (submit_button) {
      submit_button.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent collapsing the list
        const container = e.target.closest('.sc-context-container');
        // Remove all remove buttons
        container.querySelectorAll('.sc-context-remove-btn').forEach(btn => btn.remove());
        
        // Remove the submit button and its container
        const submit_container = submit_button.closest('.sc-context-submit');
        if (submit_container) {
          submit_container.remove();
        }
        
        // Collapse the list
        header.setAttribute('aria-expanded', 'false');
        
        // Proceed with processing the message after context review
        await message.thread.complete();
      });
    }
  }

  return frag;
}
