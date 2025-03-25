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
export { get_smart_server_url, enable_plugin };

const CLIENT_ID = 'smart-plugins-op';
const CLIENT_SECRET = 'smart-plugins-op-secret';

export function get_local_storage_token(oauth_storage_prefix) {
  return {
    token: localStorage.getItem(oauth_storage_prefix+'token') || '',
    refresh: localStorage.getItem(oauth_storage_prefix+'refresh') || ''
  };
}

export function set_local_storage_token({ access_token, refresh_token }, oauth_storage_prefix) {
  localStorage.setItem(oauth_storage_prefix+'token', access_token);
  if (refresh_token) {
    localStorage.setItem(oauth_storage_prefix+'refresh', refresh_token);
  }
}

/**
 * Exchange code for tokens => store them
 */
export async function exchange_code_for_tokens(code, plugin) {
  const oauth_storage_prefix = plugin.app.vault.getName().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_smart_plugins_oauth_';
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
  set_local_storage_token({ access_token, refresh_token }, oauth_storage_prefix);
}

/**
 * Install the "smart-plugins" plugin from the server using the stored token.
 * This method downloads the plugin ZIP, parses all contained files,
 * and writes them to the local .obsidian/plugins/<folderName>.
 */
export async function install_smart_plugins_plugin(plugin) {
  const oauth_storage_prefix = plugin.app.vault.getName().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_smart_plugins_oauth_';
  const { token } = get_local_storage_token(oauth_storage_prefix);
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
export async function refresh_tokens_if_needed(plugin) {
  const oauth_storage_prefix = plugin.app.vault.getName().toLowerCase().replace(/[^a-z0-9]/g, '_') + '_smart_plugins_oauth_';
  const { refresh } = get_local_storage_token(oauth_storage_prefix);
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
  set_local_storage_token({ access_token, refresh_token }, oauth_storage_prefix);
  return true;
}
