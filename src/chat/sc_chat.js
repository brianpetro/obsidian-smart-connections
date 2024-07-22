import { SmartChat } from 'smart-chats/smart_chat.js';
import { extract_folder_references } from "./extract_folder_references.js";
import { contains_internal_link } from "./contains_internal_link.js";
import { contains_folder_reference } from './contains_folder_reference.js';
import { extract_internal_links } from './extract_internal_links.js';
import { contains_system_prompt_ref, extract_system_prompt_ref } from './contains_system_prompt_ref.js';

export class ScChat extends SmartChat {
  async new_user_message(content){
    const og_content = content;
    try{
      await super.new_user_message(content);
    }catch(e){
      this.env.plugin.notices.show(e.message, e.message);
      console.warn(e);
      this.env.chat_ui.undo_last_message();
      this.env.chat_ui.set_chat_input_text(og_content);
    }
  }
  /**
   * Parses a user message to handle special syntax like mentions and converts them into system messages.
   * @param {string} content - The user message content.
   * @returns {Promise<string>} The processed content with mentions handled.
   */
  async parse_user_message(content) {
    this.env.chats.current.scope = {}; // reset scope
    // DO: decided: should this be moved to new_user_message()??? Partially as sc-context???
    if (contains_system_prompt_ref(content)) {
      const { mention, mention_pattern } = extract_system_prompt_ref(content);
      const sys_msg = {
        role: "system",
        content: "```sc-system\n" + mention + "\n```"
      }
      await this.add_message(sys_msg);
      const sys_msg_html = await this.env.chat_ui.get_system_message_html(sys_msg);
      await this.env.chat_ui.message_container.insertAdjacentHTML('beforeend', sys_msg_html);
      content = content.replace(mention_pattern, "").trim();
    }
    // if contains internal link represented by [[link]]
    if (contains_internal_link(content)) {
      const notes = extract_internal_links(this.env, content);
      console.log(notes);
      if (notes.length) {
        const context = '```sc-context\n' + notes.map(n => `${n.path}`).join('\n') + '\n```';
        const context_msg = { role: "system", content: context };
        await this.add_message(context_msg);
        const context_msg_html = await this.env.chat_ui.get_system_message_html(context_msg);
        await this.env.chat_ui.message_container.insertAdjacentHTML('beforeend', context_msg_html);
      }
    }
    // if contains folder reference represented by /folder/
    if (contains_folder_reference(content)) { // tested
      const folders = await this.env.plugin.get_folders(); // get folder references
      const folder_refs = extract_folder_references(folders, content);
      console.log(folder_refs);
      // if folder references are valid (string or array of strings)
      if (folder_refs) this.env.chats.current.scope.key_starts_with_any = folder_refs;
      console.log(this.env.chats.current.scope);
    }
    return content;
  }

  async add_tool_output(tool_name, tool_output) {
    await super.add_tool_output(tool_name, tool_output);
    await this.env.chat_ui.init(); // re-render chat UI
    await this.env.chat_ui.render_dotdotdot();
  }
}

