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

  // Claude Code CLI availability check
  await check_claude_code_cli_availability.call(this, thread, frag);
  
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

    // Enhanced error handling for Claude Code CLI
    if (thread.chat_model.adapter_name === 'claude_code_cli') {
      const help_text = document.createElement('div');
      help_text.innerHTML = `
        <br><small>
          <strong>Claude Code CLI Setup:</strong><br>
          1. Install: <code>npm install -g @anthropic-ai/cli</code><br>
          2. Login: <code>claude auth login</code><br>
          3. Verify: <code>claude --version</code>
        </small>
      `;
      help_text.style.marginTop = '8px';
      help_text.style.fontSize = '12px';
      help_text.style.color = 'var(--text-muted)';
      notice.appendChild(help_text);

      // Test connection button
      const test_button = document.createElement('button');
      test_button.textContent = 'Test Claude CLI';
      test_button.style.marginRight = '8px';
      test_button.style.marginTop = '8px';
      notice.appendChild(test_button);
      test_button.addEventListener('click', async () => {
        test_button.disabled = true;
        test_button.textContent = 'Testing...';
        const adapter = thread.chat_model.adapter;
        if (adapter && typeof adapter.test_connection === 'function') {
          await adapter.test_connection();
          // Revalidate after test
          setTimeout(() => {
            const new_validation = thread.chat_model.validate_config();
            if (new_validation.valid) {
              notice.style.display = 'none';
            }
            test_button.disabled = false;
            test_button.textContent = 'Test Claude CLI';
          }, 1000);
        }
      });
    }

    // add hide button
    const hide_button = document.createElement('button');
    hide_button.textContent = 'Hide';
    hide_button.style.marginTop = '8px';
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
  if (!message.trim()) return;
  
  chat_input.value = '';
  chat_input.disabled = true;
  
  // Show Claude Code CLI specific loading state
  const send_button = document.querySelector('#sc-send-button');
  const abort_button = document.querySelector('#sc-abort-button');
  const typing_indicator = document.querySelector('.sc-typing-indicator');
  
  if (send_button) send_button.style.display = 'none';
  if (abort_button) abort_button.style.display = 'inline-block';
  if (typing_indicator) {
    typing_indicator.style.display = 'block';
    // Add Claude Code CLI specific loading text
    if (thread.chat_model.adapter_name === 'claude_code_cli') {
      const loading_text = typing_indicator.querySelector('.claude-loading-text') || document.createElement('div');
      if (!typing_indicator.querySelector('.claude-loading-text')) {
        loading_text.className = 'claude-loading-text';
        loading_text.style.fontSize = '12px';
        loading_text.style.color = 'var(--text-muted)';
        loading_text.style.marginTop = '4px';
        typing_indicator.appendChild(loading_text);
      }
      loading_text.textContent = 'Processing with Claude Code CLI...';
    }
  }
  
  try {
    await thread.handle_message_from_user(message);
    await thread.save();
  } catch (error) {
    console.error('Error sending message:', error);
    // Show error in UI
    if (thread.chat_model.adapter_name === 'claude_code_cli') {
      const notice = document.querySelector('.sc-config-error-notice');
      if (notice) {
        notice.innerHTML = `
          <span>Claude Code CLI Error: ${error.message}</span>
          <button onclick="this.parentElement.style.display='none'" style="margin-left: 8px;">Hide</button>
        `;
        notice.style.display = 'block';
      }
    }
  } finally {
    // Reset UI state
    chat_input.disabled = false;
    if (send_button) send_button.style.display = 'inline-block';
    if (abort_button) abort_button.style.display = 'none';
    if (typing_indicator) {
      typing_indicator.style.display = 'none';
      const loading_text = typing_indicator.querySelector('.claude-loading-text');
      if (loading_text) loading_text.remove();
    }
    chat_input.focus();
  }
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

/**
 * Checks Claude Code CLI availability and shows appropriate UI feedback
 * @private
 * @async
 * @param {SmartThread} thread - Thread instance
 * @param {DocumentFragment} frag - Rendered fragment
 */
async function check_claude_code_cli_availability(thread, frag) {
  // Only check for Claude Code CLI adapter
  if (thread.chat_model.adapter_name !== 'claude_code_cli') return;
  
  const adapter = thread.chat_model.adapter;
  if (!adapter || typeof adapter.validate_connection !== 'function') return;
  
  try {
    const is_available = await adapter.validate_connection();
    const status_indicator = create_claude_status_indicator(is_available);
    
    // Insert status indicator near the chat input
    const chat_form = frag.querySelector('.sc-chat-form');
    if (chat_form && status_indicator) {
      chat_form.appendChild(status_indicator);
    }
    
    // Update placeholder text based on availability
    const chat_input = frag.querySelector('.sc-chat-input');
    if (chat_input) {
      if (is_available) {
        chat_input.placeholder = 'Chat with Claude Code CLI. Use @ to add context from your vault.';
      } else {
        chat_input.placeholder = 'Claude Code CLI not available. Please install and configure the CLI.';
        chat_input.disabled = true;
      }
    }
  } catch (error) {
    console.warn('Error checking Claude Code CLI availability:', error);
  }
}

/**
 * Creates a status indicator for Claude Code CLI
 * @private
 * @param {boolean} is_available - Whether CLI is available
 * @returns {HTMLElement} Status indicator element
 */
function create_claude_status_indicator(is_available) {
  const indicator = document.createElement('div');
  indicator.className = 'claude-status-indicator';
  indicator.style.cssText = `
    display: flex;
    align-items: center;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
    padding: 2px 6px;
    border-radius: 3px;
    background: var(--background-modifier-border);
  `;
  
  const dot = document.createElement('span');
  dot.style.cssText = `
    width: 6px;
    height: 6px;
    border-radius: 50%;
    margin-right: 6px;
    background: ${is_available ? '#4CAF50' : '#F44336'};
  `;
  
  const text = document.createElement('span');
  text.textContent = is_available 
    ? 'Claude Code CLI Ready' 
    : 'Claude Code CLI Unavailable';
  
  indicator.appendChild(dot);
  indicator.appendChild(text);
  
  return indicator;
}
