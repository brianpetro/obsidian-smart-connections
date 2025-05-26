/**
 * @deprecated in favor of platform-specific container components
 */
/**
 * @module components/threads
 * @description Renders the main chat interface including threads list, active thread, and input area
 */

/**
 * Builds the HTML string for the threads component
 * @param {SmartThreads} threads_collection - Collection of chat threads
 * @param {Object} [opts={}] - Optional parameters for customizing the build
 * @returns {string} HTML string for the threads interface
 */
export function build_html(threads_collection, opts = {}) {
  const top_bar_buttons = [
    { title: 'Open Conversation Note', icon: 'external-link' },
    { title: 'Chat History', icon: 'history' },
    { title: 'Chat Options', icon: 'sliders-horizontal', style: 'display: none;' },
    { title: 'Chat Settings', icon: 'settings' },
    { title: 'New Chat', icon: 'plus' }
  ].map(btn => `
    <button title="${btn.title}" ${btn.style ? `style="${btn.style}"` : ''}>
      ${this.get_icon_html(btn.icon)}
    </button>
  `).join('');

  return `
    <div class="sc-chat-container">
      <div class="sc-top-bar-container">
        <input class="sc-chat-name-input" type="text" value="Untitled" placeholder="Chat Name">
        ${top_bar_buttons}
      </div>
      <div id="settings" class="smart-chat-overlay" style="display: none;">
        <div class="smart-chat-overlay-header">
          <button class="smart-chat-overlay-close">
            ${this.get_icon_html('x')}
          </button>
        </div>
        <div class="sc-settings"></div>
      </div>
      <div class="sc-thread">
        <!-- Thread messages will be inserted here -->
      </div>
    </div>
    ${opts.attribution || ''}
  `;
}

/**
 * Renders the main chat interface
 * @async
 * @param {SmartThreads} threads_collection - Collection of chat threads
 * @param {Object} [opts={}] - Rendering options
 * @param {boolean} [opts.show_settings=false] - Whether to show settings panel
 * @param {boolean} [opts.show_threads=true] - Whether to show threads list
 * @returns {Promise<DocumentFragment>} Rendered chat interface
 */
export async function render(threads_collection, opts = {}) {
  const html = build_html.call(this, threads_collection, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, threads_collection, frag, opts);
}

/**
 * Post-processes the rendered chat interface
 * @async
 * @param {SmartThreads} threads_collection - Collection of chat threads
 * @param {DocumentFragment} frag - Rendered fragment
 * @param {Object} opts - Processing options
 * @returns {Promise<DocumentFragment>} Post-processed fragment
 */
export async function post_process(threads_collection, frag, opts) {
  const chat_box = frag.querySelector('.sc-thread');
  const settings_button = frag.querySelector('button[title="Chat Settings"]');
  const overlay_container = frag.querySelector(".smart-chat-overlay");
  const settings_container = overlay_container.querySelector(".sc-settings");
  
  // Initialize thread if needed
  let thread;
  if (opts.thread_key) thread = threads_collection.get(opts.thread_key);
  if (!thread) thread = threads_collection.get_active_thread();
  if (!thread) {
    thread = await threads_collection.create_or_update({});
  }
  chat_box.setAttribute('data-thread-key', thread.key);
  await thread.render(chat_box, opts);

  // Add close button handler
  const close_button = overlay_container.querySelector(".smart-chat-overlay-close");
  if (close_button) {
    close_button.addEventListener('click', () => {
      overlay_container.style.display = 'none';
    });
  }

  settings_button.addEventListener('click', () => {
    if (overlay_container.style.display === 'none') {
      threads_collection.render_settings(settings_container);
      overlay_container.style.display = 'block';
    } else {
      overlay_container.style.display = 'none';
    }
  });

  // New chat button
  const new_chat_button = frag.querySelector('button[title="New Chat"]');
  new_chat_button.addEventListener('click', async () => {
    this.empty(threads_collection.container);
    opts.thread_key = null; // clear thread key saved to `this.render_opts{}`
    threads_collection.render();
  });

  // open chat history button
  const chat_history_button = frag.querySelector('button[title="Chat History"]');
  chat_history_button.addEventListener('click', () => {
    opts.open_chat_history();
  });
  
  // Setup chat name input handler
  setup_chat_name_input_handler.call(this, frag, thread);
  
  return frag;
}

/**
 * Sets up the chat name input change handler
 * @private
 */
function setup_chat_name_input_handler(frag, thread) {
  const name_input = frag.querySelector('.sc-chat-name-input');
  if (!name_input) return;

  name_input.value = thread.key;

  // Handle renaming on blur
  name_input.addEventListener('blur', async () => {
    const new_name = name_input.value.trim();
    if (new_name && new_name !== thread.key) {
      try {
        await thread.rename(new_name);
        console.log(`Thread renamed to "${new_name}"`);
      } catch (error) {
        console.error("Error renaming thread:", error);
        // revert the name in the input field
        name_input.value = thread.key;
      }
    }
  });

  // handle renaming on Enter key
  name_input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      name_input.blur(); // Trigger the blur event
    }
  });
}