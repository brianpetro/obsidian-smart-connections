/**
 * @module components/error
 * @description Renders error messages with appropriate styling and functionality
 */

/**
 * Builds the HTML string for the error component
 * @param {Object} error - Error object containing message and details
 * @param {Object} [opts={}] - Optional parameters for customizing the build
 * @returns {string} HTML string for the error component
 */
export function build_html(error, opts = {}) {
  const error_message = error?.error?.message || error?.message || 'An unknown error occurred';
  const error_code = error?.error?.code || error?.code;
  const error_type = error?.error?.type || error?.type || 'Error';
  
  return `
    <div class="sc-error-container" role="alert">
      <div class="sc-error-header">
        <span class="sc-error-icon">${this.get_icon_html('alert-triangle')}</span>
        <span class="sc-error-type">${error_type}</span>
        ${error_code ? `<span class="sc-error-code">(${error_code})</span>` : ''}
        <button class="sc-error-close" title="Dismiss">${this.get_icon_html('x')}</button>
      </div>
      <div class="sc-error-content">
        <p class="sc-error-message">${error_message}</p>
        ${error?.error?.details ? `
          <button class="sc-error-details-toggle" aria-expanded="false">
            Show Details ${this.get_icon_html('chevron-down')}
          </button>
          <div class="sc-error-details" hidden>
            <pre>${JSON.stringify(error.error.details, null, 2)}</pre>
          </div>
        ` : ''}
      </div>
      ${opts.retry ? `
        <div class="sc-error-actions">
          <button class="sc-error-retry">
            ${this.get_icon_html('refresh-cw')} Retry
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Renders an error message
 * @async
 * @param {Object} error - Error object to render
 * @param {Object} [opts={}] - Rendering options
 * @returns {Promise<DocumentFragment>} Rendered error interface
 */
export async function render(error, opts = {}) {
  const html = build_html.call(this, error, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, error, frag, opts);
}

/**
 * Post-processes the rendered error component
 * @async
 * @param {Object} error - Error object
 * @param {DocumentFragment} frag - Rendered fragment
 * @param {Object} opts - Processing options
 * @returns {Promise<DocumentFragment>} Post-processed fragment
 */
export async function post_process(error, frag, opts) {
  // Handle close button
  const close_button = frag.querySelector('.sc-error-close');
  if (close_button) {
    close_button.addEventListener('click', () => {
      const container = close_button.closest('.sc-error-container');
      container.remove();
    });
  }

  // Handle details toggle
  const details_toggle = frag.querySelector('.sc-error-details-toggle');
  const details_content = frag.querySelector('.sc-error-details');
  if (details_toggle && details_content) {
    details_toggle.addEventListener('click', () => {
      const is_expanded = details_toggle.getAttribute('aria-expanded') === 'true';
      details_toggle.setAttribute('aria-expanded', !is_expanded);
      details_content.hidden = is_expanded;
      
      // Update toggle button text
      this.safe_inner_html(details_toggle, `
        ${is_expanded ? 'Show' : 'Hide'} Details ${this.get_icon_html(is_expanded ? 'chevron-down' : 'chevron-up')}
      `);
    });
  }

  // Handle retry button
  const retry_button = frag.querySelector('.sc-error-retry');
  if (retry_button && opts.retry && typeof opts.retry === 'function') {
    retry_button.addEventListener('click', async () => {
      const container = retry_button.closest('.sc-error-container');
      container.classList.add('retrying');
      retry_button.disabled = true;
      this.safe_inner_html(retry_button, `${this.get_icon_html('loader')} Retrying...`);
      
      try {
        await opts.retry();
        container.remove();
      } catch (retry_error) {
        // Replace with new error message
        const new_error_frag = await render.call(this, retry_error, opts);
        container.replaceWith(new_error_frag);
      }
    });
  }

  // Add auto-dismiss functionality if specified
  if (opts.auto_dismiss) {
    const dismiss_delay = typeof opts.auto_dismiss === 'number' ? opts.auto_dismiss : 5000;
    setTimeout(() => {
      const container = frag.querySelector('.sc-error-container');
      if (container) {
        container.classList.add('sc-error-fade-out');
        setTimeout(() => container.remove(), 300); // Match CSS transition duration
      }
    }, dismiss_delay);
  }

  return frag;
}

/**
 * Creates a toast-style error notification
 * @async
 * @param {Object} error - Error object
 * @param {Object} [opts={}] - Options for the toast
 * @returns {Promise<DocumentFragment>} Rendered toast notification
 */
export async function create_toast(error, opts = {}) {
  opts.auto_dismiss = opts.auto_dismiss ?? 5000; // Default to 5 seconds
  const frag = await render.call(this, error, opts);
  frag.firstChild.classList.add('sc-error-toast');
  return frag;
}

/**
 * Creates an inline error message
 * @async
 * @param {Object} error - Error object
 * @param {Object} [opts={}] - Options for the inline error
 * @returns {Promise<DocumentFragment>} Rendered inline error
 */
export async function create_inline(error, opts = {}) {
  const frag = await render.call(this, error, opts);
  frag.firstChild.classList.add('sc-error-inline');
  return frag;
}
