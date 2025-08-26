export function build_html(obsidian_view, opts = {}) {
  const top_bar_buttons = [
    // { title: 'Open Conversation Note', icon: 'external-link' },
    { title: 'New Chat', icon: 'plus' },
    { title: 'Chat History', icon: 'history' },
    { title: 'Chat Options', icon: 'sliders-horizontal', style: 'display: none;' },
    { title: 'Chat Settings', icon: 'settings' },
    { title: 'Help', icon: 'help-circle' },
  ].map(btn => `
    <button title="${btn.title}" ${btn.style ? `style="${btn.style}"` : ''}>
      ${this.get_icon_html(btn.icon)}
    </button>
  `).join('');

  return `
    <div class="sc-chat-container">
      <div class="sc-top-bar-container">
        <input class="sc-chat-name-input" type="text" value="" placeholder="Add name to save this chat">
        <div class="claude-model-indicator" id="claude-model-indicator">
          <span class="status-dot"></span>
          <span class="model-name">Claude CLI</span>
          <span class="processing-type">Local</span>
        </div>
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
    ${obsidian_view.attribution || ''}
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
export async function render(obsidian_view, opts = {}) {
  const html = build_html.call(this, obsidian_view, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, obsidian_view, frag, opts);
}

/**
 * Post-processes the rendered chat interface
 * @async
 * @param {SmartThreads} threads_collection - Collection of chat threads
 * @param {DocumentFragment} frag - Rendered fragment
 * @param {Object} opts - Processing options
 * @returns {Promise<DocumentFragment>} Post-processed fragment
 */
export async function post_process(obsidian_view, frag, opts) {
  const chat_box = frag.querySelector('.sc-thread');
  const settings_button = frag.querySelector('button[title="Chat Settings"]');
  const overlay_container = frag.querySelector(".smart-chat-overlay");
  const settings_container = overlay_container.querySelector(".sc-settings");
  // wait for threads collection to be ready
  // await obsidian_view.env.wait_for({collections: ['smart_threads']});
  while(!obsidian_view.env.smart_threads){
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  const threads_collection = obsidian_view.env.smart_threads;
  threads_collection.container = frag.querySelector('.sc-chat-container');
  
  // Initialize thread if needed
  let thread;
  if (opts.thread_key){
    thread = threads_collection.get(opts.thread_key);
  }
  if (!thread) thread = threads_collection.get_active_thread();
  if (!thread) {
    thread = await threads_collection.create_or_update({});
  }
  chat_box.setAttribute('data-thread-key', thread.key);
  await thread.render(chat_box, opts);

  // Update model indicator based on current adapter
  update_model_indicator.call(this, frag, threads_collection.chat_model);


  const chat_input = frag.querySelector('.sc-chat-form textarea');
  if (chat_input) {
    chat_input.addEventListener('keydown', obsidian_view.handle_chat_input_keydown.bind(obsidian_view));
  }

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

  // help documentation
  const help_button = frag.querySelector("[title='Help']");
  help_button.addEventListener("click", () => {
    window.open("https://docs.smartconnections.app/smart-chat", "_blank");
  });

  // New chat button
  const new_chat_button = frag.querySelector('button[title="New Chat"]');
  new_chat_button.addEventListener('click', async () => {
    this.empty(threads_collection.container);
    opts.thread_key = null; // clear thread key saved to `this.render_opts{}`
    // threads_collection.render();
    obsidian_view.render_view();
  });

  // open chat history button
  const chat_history_button = frag.querySelector('button[title="Chat History"]');
  chat_history_button.addEventListener('click', () => {
    obsidian_view.open_chat_history();
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

  if(!thread.key.startsWith('Untitled')){
    name_input.value = thread.key;
  }

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

/**
 * Updates the model indicator in the top bar to show current adapter status
 * Enhanced for local-first experience with clear processing type indication
 * @private
 * @param {DocumentFragment} frag - The rendered fragment
 * @param {Object} chat_model - The chat model instance
 */
function update_model_indicator(frag, chat_model) {
  const indicator = frag.querySelector('#claude-model-indicator');
  if (!indicator) return;

  const statusDot = indicator.querySelector('.status-dot');
  const modelName = indicator.querySelector('.model-name');
  const processingType = indicator.querySelector('.processing-type');
  
  // Helper function to determine if adapter is local
  const isLocalAdapter = (adapterName) => {
    return ['claude_code_cli', 'ollama', 'lm_studio', 'custom'].includes(adapterName);
  };
  
  if (chat_model && chat_model.adapter_name) {
    const adapter = chat_model.adapter;
    const adapterName = chat_model.adapter_name;
    const isLocal = isLocalAdapter(adapterName);
    
    // Adapter name mappings
    const adapterDisplayNames = {
      'claude_code_cli': 'Claude Code CLI',
      'ollama': 'Ollama',
      'lm_studio': 'LM Studio', 
      'custom': 'Custom API',
      'openai': 'OpenAI',
      'anthropic': 'Anthropic',
      'google': 'Google AI',
      'groq': 'Groq'
    };
    
    modelName.textContent = adapterDisplayNames[adapterName] || adapterName;
    
    // Set processing type and styling
    if (isLocal) {
      processingType.textContent = '🏠 Local';
      processingType.className = 'processing-type local';
      indicator.title = `${modelName.textContent} - Local processing (private, no API costs)`;
      
      // Special handling for Claude Code CLI
      if (adapterName === 'claude_code_cli') {
        // Check availability if adapter supports it
        if (adapter && typeof adapter.validate_connection === 'function') {
          adapter.validate_connection().then(isAvailable => {
            if (isAvailable) {
              indicator.classList.remove('unavailable');
              statusDot.style.background = '#4CAF50'; // Green for available
              indicator.title = `${modelName.textContent} - Ready (Local processing)`;
            } else {
              indicator.classList.add('unavailable');
              statusDot.style.background = '#FF9800'; // Orange for unavailable local
              indicator.title = `${modelName.textContent} - Not Available (click to install)`;
              
              // Add click handler to show installation guide
              indicator.style.cursor = 'pointer';
              indicator.addEventListener('click', () => {
                const settingsButton = frag.querySelector('button[title="Chat Settings"]');
                if (settingsButton) settingsButton.click();
              });
            }
          }).catch(() => {
            indicator.classList.add('unavailable');
            statusDot.style.background = '#FF9800';
            indicator.title = `${modelName.textContent} - Installation needed`;
          });
        } else {
          // Assume available if no validation function
          indicator.classList.remove('unavailable');
          statusDot.style.background = '#4CAF50';
        }
      } else {
        // Other local adapters
        indicator.classList.remove('unavailable');
        statusDot.style.background = '#4CAF50'; // Green for local
      }
    } else {
      processingType.textContent = '🌐 External';
      processingType.className = 'processing-type external';
      indicator.title = `${modelName.textContent} - External API (requires internet & API key)`;
      indicator.classList.remove('unavailable');
      statusDot.style.background = '#2196F3'; // Blue for external APIs
    }
  } else {
    modelName.textContent = 'No Model';
    processingType.textContent = '';
    indicator.classList.add('unavailable');
    statusDot.style.background = '#F44336'; // Red for no model
    indicator.title = 'No chat model configured';
  }
}