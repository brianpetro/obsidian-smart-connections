import ejs from "../ejs.min.cjs";
import views from "../build/views.json";

export class ScActionsUx {
  constructor(plugin, container, codeblock_type) {
    this.plugin = plugin;
    this.container = container;
    this.codeblock_type = codeblock_type;
  }
  change_code_block(code) {
    const active_file = this.plugin.app.workspace.getActiveFile();
    const note_path = active_file.path;
    // Create div for new content
    const old_content = code.substring(code.indexOf("<<<<<<< ORIGINAL\n") + "<<<<<<< ORIGINAL\n".length, code.indexOf("======="));
    const new_content = code.substring(code.indexOf("=======\n") + "=======\n".length, code.indexOf(">>>>>>>"));
    // Calculate time saved in minutes based on 50wpm typing speed and new content length
    const time_saved = (Math.round(new_content.split(" ").length / 50) || 1) + " min";
    this.container.innerHTML = this.render_template("sc_change", { new_content, old_content, time_saved });

    console.log(this.container);
    const new_content_container = this.container.querySelector('.new-content');
    const old_content_container = this.container.querySelector('.old-content');
    this.plugin.obsidian.MarkdownRenderer.renderMarkdown(new_content, new_content_container, note_path, new this.plugin.obsidian.Component());
    this.plugin.obsidian.MarkdownRenderer.renderMarkdown(old_content, old_content_container, note_path, new this.plugin.obsidian.Component());
    // approve (accept) button
    const approve_button = this.get_button_by_text("Accept");
    approve_button.onclick = async () => {
      console.log("Accepted");
      // update note to replace code block with new content
      const content = await this.plugin.app.vault.cachedRead(active_file);
      const updated_content = content.replace("```" + this.codeblock_type + "\n" + code + "\n```", new_content.trim());
      await this.plugin.app.vault.modify(active_file, updated_content);
      // appended to accepted_changes file
      await this.append_accepted_changes({ note_path, old_content, new_content, time_saved });

    }
    // reject button
    const reject_button = this.get_button_by_text("Reject");
    reject_button.onclick = async () => {
      // update note to replace code block with old content
      const content = await this.plugin.app.vault.cachedRead(active_file);
      const updated_content = content.replace("```" + this.codeblock_type + "\n" + code + "\n```", old_content.trim());
      await this.plugin.app.vault.modify(active_file, updated_content);
    }

  }
  async append_accepted_changes(change) {
    const file_path = this.plugin.settings.smart_connections_folder + "/accepted_changes.ndjson";
    if(!(await this.plugin.app.vault.exists(file_path))){
      console.log("File does not exist, creating it");
      await this.plugin.app.vault.create(file_path, "");
    }
    await this.plugin.app.vault.adapter.append(file_path, JSON.stringify(change) + "\n");
  }
  render_template(template_name, data) {
    if (!views[template_name]) throw new Error(`Template '${template_name}' not found.`);
    return ejs.render(views[template_name], data, { context: this });
  }
  get_button_by_text(text) { return get_button_by_text(this.container, text); }
  get_icon(name) { return this.plugin.obsidian.getIcon(name).outerHTML; }
  get attribution() { return views.attribution; }
}
function get_button_by_text(container, text) { return Array.from(container.querySelectorAll('button')).find(button => button.textContent === text); }