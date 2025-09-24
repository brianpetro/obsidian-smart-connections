// Stub for smart-plugins-obsidian/utils.js functions
// This is needed because sc_oauth.js imports from smart-plugins-obsidian
// but we don't need OAuth functionality for our MCP server

export function get_smart_server_url() {
  return 'https://smart-plugins.com';
}

export function fetch_plugin_zip() {
  throw new Error('OAuth plugin installation not available in MCP build');
}

export function parse_zip_into_files() {
  throw new Error('OAuth plugin installation not available in MCP build');
}

export function write_files_with_adapter() {
  throw new Error('OAuth plugin installation not available in MCP build');
}

export function enable_plugin() {
  console.log('Plugin enable not available in MCP build');
  return false;
}