import { post_process } from 'smart-environment/components/settings.js';
export async function build_html(scope, opts = {}) {
  const env_settings_html = Object.entries(scope.settings_config).map(([setting_key, setting_config]) => {
    if (!setting_config.setting) setting_config.setting = setting_key;
    if(this.validate_setting(scope, opts, setting_key, setting_config)) return this.render_setting_html(setting_config);
    return '';
  }).join('\n');
  const html = `
    <div class="">
      ${env_settings_html}
      <div data-smart-settings="smart_sources"></div>
      <div data-smart-settings="smart_blocks"></div>
    </div>
  `;
  return html;
}

export async function render(scope, opts = {}) {
  // gets main env settings html from module
  let html = await build_html.call(this, scope, opts);
  const frag = this.create_doc_fragment(html);
  // imported post_process from smart-environment/components/settings.js
  return await post_process.call(this, scope, frag, opts);
}