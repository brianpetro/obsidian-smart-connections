import { build_html, post_process } from 'smart-environment/components/settings.js';

export async function render(scope, opts = {}) {
  // gets main env settings html from module
  let html = await build_html.call(this, scope, opts);
  // appends smart chat settings html
  html += `
    <h3>Smart Chat</h3>
    <p>
      <i>Additional settings available in the Smart Chat settings tab (ex. chat model and api key).</i>
    </p>
    <div class="setting-component"
      data-name="Smart Chat History Folder"
      data-description="Folder to store Smart Chat history. Use a preceeding <code>.</code> to hide it (ex. <code>.smart-chats</code>)."
      data-type="text"
      data-setting="smart_chats.fs_path"
      data-placeholder="Enter a folder name"
    ></div>
    <h3>System Prompts</h3>
    <div class="setting-component"
      data-name="System Prompts Folder"
      data-description="Folder to store system prompts. Available in chat by typing '@'"
      data-type="text"
      data-setting="smart_chats.prompts_path"
      data-placeholder="Enter a folder name"
    ></div>
  `;
  const frag = this.create_doc_fragment(html);
  // imported post_process from smart-environment/components/settings.js
  return post_process.call(this, scope, frag, opts);
}