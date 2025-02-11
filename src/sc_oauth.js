/**
 * @file sc_oauth.js
 * @description Reusable OAuth logic for SC OP. We store tokens in localStorage under:
 *   - smart_plugins_oauth_token
 *   - smart_plugins_oauth_refresh
 *
 * Handles:
 *   1) Exchanging code for tokens
 *   2) Installing "smart-plugins" from the server via plugin_download
 *   3) Importing and using parse_zip_into_files from ../smart-plugins-obsidian/utils.js
 */

import { requestUrl } from 'obsidian';

// Use the same utilities from smart-plugins-obsidian:
import {
  get_smart_server_url,
  fetch_plugin_zip,
  parse_zip_into_files,
  write_files_with_adapter,
  enable_plugin,
} from '../../smart-plugins-obsidian/utils.js';
export { get_smart_server_url };

const CLIENT_ID = 'smart-plugins-op';
const CLIENT_SECRET = 'smart-plugins-op-secret';

export function getLocalStorageTokens() {
  return {
    token: localStorage.getItem('smart_plugins_oauth_token') || '',
    refresh: localStorage.getItem('smart_plugins_oauth_refresh') || ''
  };
}

export function setLocalStorageTokens({ access_token, refresh_token }) {
  localStorage.setItem('smart_plugins_oauth_token', access_token);
  if (refresh_token) {
    localStorage.setItem('smart_plugins_oauth_refresh', refresh_token);
  }
}

/**
 * Exchange code for tokens => store them
 */
export async function exchange_code_for_tokens(code) {
  const url = `${get_smart_server_url()}/auth/oauth_exchange2`;
  const resp = await requestUrl({
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code
    })
  });
  if (resp.status !== 200) {
    throw new Error(`OAuth exchange error ${resp.status} ${resp.text}`);
  }
  const { access_token, refresh_token } = resp.json;
  if (!access_token) {
    throw new Error('No access_token in response');
  }
  setLocalStorageTokens({ access_token, refresh_token });
}

/**
 * Install the "smart-plugins" plugin from the server using the stored token.
 * This method downloads the plugin ZIP, parses all contained files,
 * and writes them to the local .obsidian/plugins/<folderName>.
 */
export async function installSmartPlugins(plugin) {
  const { token } = getLocalStorageTokens();
  if (!token) throw new Error('No token found to install "smart-plugins"');
  const repo = 'brianpetro/smart-plugins-obsidian';

  // Use the same approach as 'smart-plugins' to parse the entire ZIP
  const zipData = await fetch_plugin_zip(repo, token);
  const { files, pluginManifest } = await parse_zip_into_files(zipData);

  let folder_name = (pluginManifest?.id || 'smart-plugins').trim();
  folder_name = folder_name.replace(/[^\w-]/g, '_');

  const base_folder = '.obsidian/plugins/' + folder_name;

  // Write all extracted files
  await write_files_with_adapter(plugin.app.vault.adapter, base_folder, files);

  // Force Obsidian to reload plugin manifests
  await plugin.app.plugins.loadManifests();

  // If the manifest ID is recognized by Obsidian, enable the plugin
  if (plugin.app.plugins.manifests[folder_name]) {
    await enable_plugin(plugin.app, folder_name);
  }
}

/**
 * (Optional) Example: refresh tokens
 */
export async function refresh_tokens_if_needed() {
  const { refresh } = getLocalStorageTokens();
  if (!refresh) return false;
  const url = `${get_smart_server_url()}/auth/oauth_exchange2`;
  const resp = await requestUrl({
    url,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refresh
    })
  });
  if (resp.status !== 200) {
    console.warn(`Refresh tokens error ${resp.status} ${resp.text}`);
    return false;
  }
  const { access_token, refresh_token } = resp.json;
  if (!access_token) return false;
  setLocalStorageTokens({ access_token, refresh_token });
  return true;
}
