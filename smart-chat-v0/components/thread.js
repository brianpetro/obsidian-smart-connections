/**
 * @module components/thread
 * @description Renders a single chat thread with its messages
 */

/**
 * Builds the HTML string for the thread component
 * @param {SmartThread} thread - Thread instance to render
 * @param {Object} [opts={}] - Optional parameters for customizing the build
 * @returns {string} HTML string for the thread
 */
export function build_html(thread, opts = {}) {
  return `
    <div class="sc-thread" data-thread-key="${thread.key}">
      <div class="sc-message-container">
        ${opts.show_welcome && !thread.messages.length ? `
          <div class="sc-message assistant">
            <div class="sc-message-content">
              <span>${thread.collection.initial_message}</span>
            </div>
          </div>
        ` : ''}
      </div>
      <div class="sc-typing-indicator">
        <div class="sc-typing-dots">
          <div class="sc-typing-dot"></div>
          <div class="sc-typing-dot"></div>
          <div class="sc-typing-dot"></div>
        </div>
      </div>
      <div class="sc-config-error-notice" style="display: none;"></div>
      <div class="sc-chat-form">
        <textarea class="sc-chat-input" placeholder="Use @ to add context. Try &quot;Based on my notes&quot; or &quot;Summarize [[this note]]&quot; or &quot;Important tasks in /folder/&quot;"></textarea>
        <div class="sc-btn-container">
          <span id="sc-abort-button" style="display: none;">${this.get_icon_html('square')}</span>
          <button class="send-button" id="sc-send-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="16" fill="currentColor" />
              <path fill="currentColor" fill-rule="evenodd" d="M15.192 8.906a1.143 1.143 0 0 1 1.616 0l5.143 5.143a1.143 1.143 0 0 1-1.616 1.616l-3.192-3.192v9.813a1.143 1.143 0 0 1-2.286 0v-9.813l-3.192 3.192a1.143 1.143 0 1 1-1.616-1.616z" clip-rule="evenodd" fill="#727272"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Renders a chat thread
 * @async
 * @param {SmartThread} thread - Thread instance to render
 * @param {Object} [opts={}] - Rendering options
 * @param {boolean} [opts.show_welcome=true] - Whether to show welcome message for empty threads
 * @returns {Promise<DocumentFragment>} Rendered thread interface
 */
export async function render(thread, opts = {}) {
  const html = build_html.call(this, thread, {
    show_welcome: opts.show_welcome !== false
  });
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, thread, frag, opts);
}

/**
 * Post-processes the rendered thread
 * @async
 * @param {SmartThread} thread - Thread instance
 * @param {DocumentFragment} frag - Rendered fragment
 * @param {Object} opts - Processing options
 * @returns {Promise<DocumentFragment>} Post-processed fragment
 */
export async function post_process(thread, frag, opts) {
  const container = frag.querySelector('.sc-message-container');
  // If we have messages, render them
  if (thread.messages.length) {
    // append empty elms for each message
    thread.messages.forEach(msg => {
      const msg_elm = document.createElement('div');
      msg_elm.id = msg.data.id;
      container.appendChild(msg_elm);
    });
    await Promise.all(
      thread.messages.map(msg => msg.render(container))
    );
  }
  
  // Setup chat input handlers
  const chat_input = frag.querySelector('.sc-chat-form textarea');
  if (chat_input) {
    chat_input.addEventListener('keydown', async (e) => {
      const is_mod = this.adapter.is_mod_event(e);
      if (e.key === "Enter" && (is_mod || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        await send_message(chat_input, thread);
        return;
      }
    });
    chat_input.addEventListener('keyup', (e) => handle_chat_input_keyup.call(this, e, chat_input));
  }
  
  // Scroll to bottom of container if needed
  if (container.scrollHeight > container.clientHeight) {
    container.scrollTop = container.scrollHeight;
  }

  // Send button
  const send_button = frag.querySelector('#sc-send-button');
  send_button.addEventListener('click', async () => {
    await send_message(chat_input, thread);
  });
  // Abort button
  const abort_button = frag.querySelector('#sc-abort-button');
  abort_button.addEventListener('click', () => {
    thread.chat_model.abort_current_response();
    thread.clear_streaming_ux();
  });

  // Insert notice if configuration is invalid
  const validation_result = thread.chat_model.validate_config();
  if (!validation_result.valid) {
    const notice = frag.querySelector('.sc-config-error-notice');
    const message = document.createElement('span');
    message.textContent = validation_result.message;
    notice.appendChild(message);
    notice.style.display = '';
    // // Replace close button with open settings button
    // const open_settings_button = document.createElement('button');
    // open_settings_button.textContent = 'Open Settings';
    // notice.appendChild(open_settings_button);
    
    // // Add click handler to open settings
    // open_settings_button.addEventListener('click', () => {
    //   settings_button.click();
    // });

    // add hide button
    const hide_button = document.createElement('button');
    hide_button.textContent = 'Hide';
    notice.appendChild(hide_button);
    hide_button.addEventListener('click', () => {
      notice.style.display = 'none';
    });
  }
  
  // Style typing indicator based on theme
  const typing_indicator = frag.querySelector('.sc-typing-indicator');
  if (typing_indicator) {
    const is_dark = document.body.classList.contains('theme-dark');
    typing_indicator.style.setProperty('--text-muted', is_dark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)');
  }

  return frag;

}


async function send_message(chat_input, thread) {
  const message = chat_input.value;
  chat_input.value = '';
  await thread.handle_message_from_user(message);
  await thread.save();
}

/**
 * Handles chat input keyup events
 * @private
 */
function handle_chat_input_keyup(e, chat_input) {
  clearTimeout(this.resize_debounce);
  this.resize_debounce = setTimeout(() => {
    chat_input.style.height = 'auto';
    chat_input.style.height = `${chat_input.scrollHeight}px`;
  }, 200);
}
