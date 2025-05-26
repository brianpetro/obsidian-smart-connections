/**
 * @module components/message
 * @description Renders individual chat messages with support for various content types
 */

/**
 * Builds the HTML string for the message component
 * @param {SmartMessage} message - Message instance to render
 * @param {Object} [opts={}] - Optional parameters for customizing the build
 * @returns {string} HTML string for the message
 */
export function build_html(message, opts = {}) {
  const content = Array.isArray(message.content) 
    ? message.content.map(part => {
        if (part.type === "image_url") {
          return ' ![[' + part.input.image_path + ']] ';
        }
        if (part.type === 'text' && part.input?.key?.length) return ' ![[' + part.input.key + ']] ';
        if (part.type === 'text' && part.text?.length) return part.text;
      }).join('\n')
    : message.content;

  // Get branches for this message
  const branches = message.thread.get_branches(message.msg_i);
  const has_branches = branches && branches.length > 0;

  // Build base HTML
  let html = `
    <div class="sc-message ${message.role}" id="${message.data.id}">
      <div class="sc-message-content" data-content="${encodeURIComponent(content)}">
        <span>${content}</span>
        <div class="sc-msg-buttons">
          <span class="sc-msg-button" title="Copy message to clipboard">${this.get_icon_html('copy')}</span>
          ${has_branches ? `
            <span class="sc-msg-button cycle-branch" title="Cycle through message variations">${message.branch_i.split('-').pop()} / ${branches.length + 1} ${this.get_icon_html('chevron-right')}</span>
          ` : ''}
          ${message.role === 'assistant' ? `
            <span class="sc-msg-button regenerate" title="Regenerate response">${this.get_icon_html('refresh-cw')}</span>
          ` : `
            <span class="sc-msg-button edit" title="Edit message">${this.get_icon_html('edit')}</span>
          `}
        </div>
      </div>
      ${message.role === 'user' ? `<textarea class="sc-message-edit" style="display: none;">${content}</textarea>` : ''}
    </div>
  `;

  // If user message has self_ref, show "expecting lookup" indicator after the bubble
  if (message.role === 'user' && message.context?.has_self_ref === true) {
    html += `
      <div class="sc-tool-call-missing-indicator" style="font-style: italic; margin-top: 4px;">
        expecting lookup
      </div>
    `;
  }


  return html;
}
/**
 * Renders a chat message
 * @async
 * @param {SmartMessage} message - Message instance to render
 * @param {Object} [opts={}] - Rendering options
 * @param {boolean} [opts.show_role=true] - Whether to show message role
 * @param {boolean} [opts.show_timestamp=true] - Whether to show message timestamp
 * @returns {Promise<DocumentFragment>} Rendered message interface
 */
export async function render(message, opts = {}) {
  const html = build_html.call(this, message, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, message, frag, opts);
}

/**
 * Post-processes the rendered message
 * @async
 * @param {SmartMessage} message - Message instance
 * @param {DocumentFragment} frag - Rendered fragment
 * @param {Object} opts - Processing options
 * @returns {Promise<DocumentFragment>} Post-processed fragment
 */
export async function post_process(message, frag, opts) {
  const copy_button = frag.querySelector('.sc-msg-button:not(.regenerate)');
  if (copy_button) {
    copy_button.addEventListener('click', () => {
      navigator.clipboard.writeText(message.content)
        .then(() => {
          console.log('Message copied to clipboard');
        })
        .catch(err => {
          console.error('Failed to copy message: ', err);
        });
    });
  }

  const regenerate_button = frag.querySelector('.sc-msg-button.regenerate');
  if (regenerate_button) {
    regenerate_button.addEventListener('click', async () => {
      const thread = message.thread;
      const msg_i = thread.data.messages[message.data.id];
      
      // Move current message and subsequent messages to branches
      if (!thread.data.branches) thread.data.branches = {};
      if (!thread.data.branches[msg_i]) thread.data.branches[msg_i] = [];
      
      const branch_messages = {};
      Object.entries(thread.data.messages)
        .filter(([_, i]) => i >= msg_i)
        .forEach(([key, i]) => {
          branch_messages[key] = i;
          delete thread.data.messages[key];
        });
      
      thread.data.branches[msg_i].push(branch_messages);

      await thread.render();
      
      // Trigger regeneration
      await thread.complete();
    });
  }

  const cycle_branch_button = frag.querySelector('.sc-msg-button.cycle-branch');
  if (cycle_branch_button) {
    cycle_branch_button.addEventListener('click', async () => {
      await message.thread.cycle_branch(message.msg_i);
    });
  }

  const edit_button = frag.querySelector('.sc-msg-button.edit');
  if (edit_button) {
    const msg_content = frag.querySelector('.sc-message-content');
    const edit_textarea = frag.querySelector('.sc-message-edit');
    
    edit_button.addEventListener('click', async () => {
      const is_editing = edit_textarea.style.display === 'block';
      
      if (is_editing) {
        // Save changes and resubmit
        const new_content = edit_textarea.value.trim();
        if (new_content !== message.content) {
          // Store current messages as a branch
          const thread = message.thread;
          const msg_i = thread.data.messages[message.data.id];
          
          // Create a branch with current messages
          const current_messages = Object.entries(thread.data.messages)
            .filter(([_, i]) => i >= msg_i)
            .reduce((acc, [id, i]) => ({ ...acc, [id]: i }), {});
          
          // Move current messages to branch BEFORE updating content
          thread.move_to_branch(msg_i, current_messages);
          
          msg_content.querySelector('span').textContent = new_content;
          msg_content.setAttribute('data-content', encodeURIComponent(new_content));
          
          // Hide edit interface
          edit_textarea.style.display = 'none';
          msg_content.style.display = 'block';
          this.safe_inner_html(edit_button, this.get_icon_html('edit'));
          edit_button.title = 'Edit message';
          
          // Use existing thread method to handle the edited message
          await thread.handle_message_from_user(new_content);
          await thread.render();
        } else {
          // Just hide textarea if no changes
          edit_textarea.style.display = 'none';
          msg_content.style.display = 'block';
          this.safe_inner_html(edit_button, this.get_icon_html('edit'));
          edit_button.title = 'Edit message';
        }
      } else {
        // Show textarea for editing
        edit_textarea.style.display = 'block';
        this.safe_inner_html(edit_button, this.get_icon_html('check'));
        edit_button.title = 'Save changes';
        edit_textarea.focus();
      }
    });
    
    // Handle Ctrl+Enter to save
    edit_textarea.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        edit_button.click();
      }
    });
  }

  const msg_span = frag.querySelector('.sc-message-content > span:first-child');
  const markdown_rendered_frag = await this.render_markdown(msg_span.textContent, message);
  this.empty(msg_span);
  msg_span.appendChild(markdown_rendered_frag);
  
  return frag;
}