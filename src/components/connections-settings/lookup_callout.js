import { setIcon, requestUrl } from "obsidian";
import { enable_plugin } from "obsidian-smart-env/src/utils/smart_plugins.js";
export function build_html(plugin, opts={}) {
  return `<div class="wrapper">
    <div id="footer-callout" data-callout-metadata="" data-callout-fold="" data-callout="info" class="callout" style="mix-blend-mode: unset;">
      <div class="callout-title" style="align-items: center;">
        <div class="callout-icon">
        </div>
        <div class="callout-title-inner"><strong>Smart Lookup</strong></div>
      </div>
      <div class="callout-content">
        <p></p>
        <button></button>
      </div>
    </div>
  </div>`;
}

export function render(plugin, params={}) {
  const html = build_html.call(this, plugin, params);
  const frag = this.create_doc_fragment(html);
  const container = frag.firstElementChild;
  post_process.call(this, plugin, container, params);
  return container;
}

function post_process(plugin, container) {
  const icon_container = container.querySelector('.callout-icon');
  setIcon(icon_container, 'smart-lookup');
  const has_lookup = plugin.app.plugins.enabledPlugins.has('smart-lookup');
  const content_container = container.querySelector('.callout-content');
  const callout_text = content_container.querySelector('p');
  const callout_btn = content_container.querySelector('button');
  if (has_lookup) {
    callout_text.textContent = 'Lookup now has its own settings tab.';
    callout_btn.textContent = 'Open lookup settings';
    callout_btn.addEventListener('click', () => {
      plugin.app.setting.openTabById('smart-lookup');
    });
  } else {
    callout_text.textContent = 'Lookup is moving to a dedicated plugin. Please install to continue using lookup features and access lookup settings.';
    callout_btn.textContent = 'Install';
    callout_btn.addEventListener('click', () => install_smart_lookup(plugin));
  }
}


async function install_smart_lookup(plugin) {
  const app = plugin.app;
  const env = plugin.env;
  const adapter = app.vault.adapter;

  async function download_and_write(url, _path) {
    try {
      const resp = await requestUrl({
        url,
        method: "GET",
      });
      await adapter.write(_path, resp.text);
      return true;
    } catch (error) {
      console.error(`Failed to download or write file from ${url} to ${_path}:`, error);
      env.events.emit('plugin:install_failed', {
        level: 'error',
        message: `Failed to download or write Smart Lookup file "${_path.split('/').slice(-1)[0]}" from "${url}"`,
        event_source: 'install_smart_lookup',
      });
      return false;
    }
  }

  const { json: response } = await requestUrl({
    url: "https://api.github.com/repos/brianpetro/smart-lookup-obsidian/releases/latest",
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    contentType: "application/json",
  });
  // get browser_download_url for main.js, manifest.json, and styles.css
  const assets = response.assets;
  const main_asset = assets.find((asset) => asset.name === 'main.js');
  const manifest_asset = assets.find((asset) => asset.name === 'manifest.json');
  const styles_asset = assets.find((asset) => asset.name === 'styles.css');
  if (!main_asset || !manifest_asset || !styles_asset) {
    env.events.emit('plugin:install_failed', {
      level: 'error',
      message: 'Failed to find necessary assets for Smart Lookup. Installation failed.',
      event_source: 'install_smart_lookup',
    });
    return;
  }
  const main_url = main_asset.browser_download_url;
  const manifest_url = manifest_asset.browser_download_url;
  const styles_url = styles_asset.browser_download_url;
  // download and write each to ${app.vault.configDir}/plugins/smart-lookup/..
  const plugin_folder = `${app.vault.configDir}/plugins/smart-lookup`;
  if (!await adapter.exists(plugin_folder)) {
    await adapter.mkdir(plugin_folder);
  }
  const results = await Promise.all([
    download_and_write(main_url, `${plugin_folder}/main.js`),
    download_and_write(manifest_url, `${plugin_folder}/manifest.json`),
    download_and_write(styles_url, `${plugin_folder}/styles.css`),
  ]);
  if (results.some((result) => result === false)) {
    return;
  }
  // enable the plugin
  await app.plugins.loadManifests();
  if (!app.plugins.enabledPlugins.has('smart-lookup')) {
    enable_plugin(app, 'smart-lookup'); // no await to emit notice before enabling (thus unloading env)
  }

  env.events.emit('plugin:install_completed', {
    level: 'info',
    message: 'Smart Lookup installed.',
    event_source: 'install_smart_lookup',
  });

}