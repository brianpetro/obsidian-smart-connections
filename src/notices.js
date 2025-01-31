/**
 * @file notices.js
 * @description Exported object of all user-facing notice texts, keyed by the exact first-arg used in 'notices.show(key, ...)' calls.
 */

/**
 * @typedef {Object} NoticeEntry
 * @property {string} en - English text for this notice (may include Handlebars-like {{placeholders}}).
 */

/**
 * Provides a dictionary of notices keyed by their exact notice ID.
 * @type {Record<string, NoticeEntry>}
 */
export const NOTICES = {
  item_excluded: {
    en: 'Cannot show Smart Connections for excluded entity: {{entity_key}}'
  },
  load_env: {
    en: 'Mobile detected: to prevent performance issues, click to load Smart Environment when ready.',
    button: {
      en: `Load Smart Env`,
      callback: (scope) => { scope.load_env(); }
    },
    timeout: 0
  },
  missing_entity: {
    en: 'No entity found for key: {{key}}'
  },
  notice_muted: {
    en: 'Notice muted'
  },
  new_version_available: {
    en: 'A new version is available! (v{{version}})'
  },
  new_early_access_version_available: {
    en: 'A new early access version is available! (v{{version}})'
  },
  supporter_key_required: {
    en: 'Supporter license key required for early access update'
  },
  revert_to_stable_release: {
    en: 'Click "Check for Updates" in the community plugins tab and complete the update for Smart Connections to finish reverting to the stable release.',
    timeout: 0
  },
  action_installed: {
    en: 'Installed action "{{name}}"'
  },
  action_install_error: {
    en: 'Error installing action "{{name}}": {{error}}',
    timeout: 0
  },
  embed_model_not_loaded: {
    en: 'Embed model not loaded. Please wait for the model to load and try again.'
  },
  embed_search_text_failed: {
    en: 'Failed to embed search text.'
  },
  error_in_embedding_search: {
    en: 'Error in embedding search. See console for details.'
  },
  copied_to_clipboard: {
    en: 'Message: {{content}} copied successfully.'
  },
  copy_failed: {
    en: 'Unable to copy message to clipboard.'
  },
  'requires smart view': {
    en: 'Smart View must be open to utilize all Smart Chat features. For example, asking things like "Based on my notes..." requires Smart View to be open.'
  },
  'Supporter license key required for early access update': {
    en: 'Supporter license key required for early access update'
  }
};
