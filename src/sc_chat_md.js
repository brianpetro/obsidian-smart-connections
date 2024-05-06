const { SmartChatMD } = require('smart-chats/smart_chat_md');
const { extract_folder_references } = require("./extract_folder_references");
const { contains_internal_link } = require("./contains_internal_link");
const { contains_folder_reference } = require('./contains_folder_reference');

class ScChatMD extends SmartChatMD {
  async new_user_message(content){
    const og_content = content;
    try{
      await super.new_user_message(content);
    }catch(e){
      this.env.plugin.notices.show(e.message, e.message);
      console.warn(e);
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
    if (content.includes("@\"")) {
      const mention_pattern = /@\"([^"]+)\"/;
      const mention = content.match(mention_pattern)[1];
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
exports.ScChatMD = ScChatMD;

function extract_internal_links(env, user_input) {
  const matches = user_input.match(/\[\[(.*?)\]\]/g);
  console.log(matches);
  // return array of TFile objects
  if (matches) return matches.map(match => {
    const tfile = env.plugin.app.metadataCache.getFirstLinkpathDest(match.replace("[[", "").replace("]]", ""), "/");
    return tfile;
  });
  return [];
}
exports.extract_internal_links = extract_internal_links;