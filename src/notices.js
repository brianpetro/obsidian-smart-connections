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
  copied_chatgpt_url_to_clipboard: {
    en: 'ChatGPT URL copied to clipboard.'
  },
  loading_collection: {
    en: 'Loading {{collection_key}}...'
  },
  done_loading_collection: {
    en: '{{collection_key}} loaded.'
  },
  saving_collection: {
    en: 'Saving {{collection_key}}...'
  },
  initial_scan: {
    en: 'Starting initial scan...',
    timeout: 0
  },
  done_initial_scan: {
    en: 'Initial scan complete.',
    timeout: 3000
  },
  pruning_collection: {
    en: 'Pruning {{collection_key}}...'
  },
  done_pruning_collection: {
    en: 'Pruned {{count}} items from {{collection_key}}.'
  },
  embedding_progress: {
    en: 'Embedding progress: {{progress}} / {{total}}\n{{tokens_per_second}} tokens/sec using {{model_name}}',
    button: {
      en: 'Pause',
      callback: (scope) => { scope._embed_model.adapter.halt_embed_queue_processing(); }
    },
    timeout: 0
  },

  embedding_complete: {
    en: 'Embedding complete. {{total_embeddings}} embeddings created. {{tokens_per_second}} tokens/sec using {{model_name}}',
    timeout: 0
  },
  embedding_paused: {
    en: 'Embedding paused. Progress: {{progress}} / {{total}}\n{{tokens_per_second}} tokens/sec using {{model_name}}',
    button: {
      en: 'Resume',
      callback: (scope) => { scope._embed_model.adapter.resume_embed_queue_processing(100); }
    },
    timeout: 0
  },

  import_progress: {
    en: 'Importing... {{progress}} / {{total}} sources',
    timeout: 0
  },

  done_import: {
    en: 'Import complete. {{count}} sources imported in {{time_in_seconds}}s',
    timeout: 0
  },

  no_import_queue: {
    en: 'No items in import queue'
  },
  
  clearing_all: {
    en: 'Clearing all data...',
    timeout: 0
  },


  done_clearing_all: {
    en: 'All data cleared and reimported',
    timeout: 3000
  },

  image_extracting: {
    en: 'Extracting text from Image(s)',
    timeout: 0
  },

  pdf_extracting: {
    en: 'Extracting text from PDF(s)',
    timeout: 0
  },

  insufficient_settings: {
    en: 'Insufficient settings for {{key}}, missing: {{missing}}',
    timeout: 0
  },




};


