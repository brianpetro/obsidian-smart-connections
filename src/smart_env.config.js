import {
  SmartSources,
  SmartBlocks,
  SmartSource,
  SmartBlock,
} from "./sc_entities.js";
import { SourceAdapter } from "smart-sources/adapters/_adapter.js";
import { MarkdownSourceAdapter } from "smart-sources/adapters/markdown.js";
import { SmartCollectionMultiFileDataAdapter } from "smart-collections/adapters/multi_file";
import { SmartEmbedModel } from "smart-embed-model";
import { SmartEmbedOpenAIAdapter } from "smart-embed-model/adapters/openai.js";
import { SmartEmbedTransformersIframeAdapter } from "smart-embed-model/adapters/transformers_iframe.js";
import { SmartFs } from 'smart-file-system/smart_fs.js';
import { SmartFsObsidianAdapter } from 'smart-file-system/adapters/obsidian.js';
import { SmartView } from 'smart-view/smart_view.js';
import { SmartViewObsidianAdapter } from 'smart-view/adapters/obsidian.js';
import { SmartNotices } from "./smart_notices.js";
import { Notice } from "obsidian";
import { SmartSettings } from "smart-settings";
import { render as source_settings_component } from 'smart-sources/components/settings.js';
import { render as env_settings_component } from './components/env_settings.js';
import { render as connections_component } from './components/connections.js';
import { render as search_component } from './components/lookup.js';
// import { SmartViewNodeAdapter } from 'smart-view/adapters/node.js';

export const smart_env_config = {
  global_ref: window,
  env_path: '',
  // env_data_dir: '.smart-env', // added in Plugin class
  collections: {
    smart_collections: {
      data_adapter: SmartCollectionMultiFileDataAdapter
    },
    smart_sources: {
      class: SmartSources,
      data_adapter: SmartCollectionMultiFileDataAdapter,
      source_adapters: {
        "md": MarkdownSourceAdapter,
        "txt": MarkdownSourceAdapter, // temp
        "canvas": MarkdownSourceAdapter, // temp
        "default": SourceAdapter,
      },
      components: {
        settings: source_settings_component,
      },
    },
    smart_blocks: {
      class: SmartBlocks,
      components: {
        settings: source_settings_component,
      },
    },
  },
  item_types: {
    SmartSource,
    SmartBlock,
  },
  modules: {
    // smart_chat_model: SmartChatModel, // TODO: migrate to v2 chat model
    smart_embed_model: {
      class: SmartEmbedModel,
      adapters: {
        transformers: SmartEmbedTransformersIframeAdapter,
        openai: SmartEmbedOpenAIAdapter,
      },
    },
    smart_fs: {
      class: SmartFs,
      adapter: SmartFsObsidianAdapter,
    },
    smart_view: {
      class: SmartView,
      adapter: SmartViewObsidianAdapter,
    },
    smart_notices: {
      class: SmartNotices,
      adapter: Notice,
    },
    smart_settings: {
      class: SmartSettings,
    },
  },
  components: {
    settings: env_settings_component,
    connections: connections_component,
    search: search_component,
  },
  default_settings: {
    is_obsidian_vault: true,
    smart_blocks: {
      embed_blocks: true,
    },
    smart_sources: {
      embed_model: {
        model_key: 'TaylorAI/bge-micro-v2',
        legacy_transformers: true,
      },
    },
    file_exclusions: 'Untitled',
    folder_exclusions: 'smart-chats',
  },
};
