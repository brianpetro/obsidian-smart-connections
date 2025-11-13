import { AjsonMultiFileCollectionDataAdapter } from "smart-collections/adapters/ajson_multi_file.js";
import { SmartFs } from 'smart-file-system/smart_fs.js';
import { SmartFsObsidianAdapter } from 'smart-file-system/adapters/obsidian.js';
// import { SmartView } from 'smart-view/smart_view.js';
// import { SmartViewObsidianAdapter } from 'smart-view/adapters/obsidian.js';
import { render as collection_settings_component } from 'smart-view/components/settings.js';
import { render as model_settings_component } from "smart-model/components/settings.js";
import { render as connections_component } from './components/connections.js';
import { render as lookup_component } from './components/lookup.js';
import { render as results_component } from './components/connections_results.js';
import { render as smart_chat_component } from './views/smart_chat.js';
import { SmartChatModel } from "smart-chat-model";
import {
  SmartChatModelAnthropicAdapter,
  SmartChatModelAzureAdapter,
  // SmartChatModelCohereAdapter,
  SmartChatModelCustomAdapter,
  SmartChatModelGoogleAdapter,
  SmartChatModelGeminiAdapter,
  SmartChatModelGroqAdapter,
  SmartChatModelLmStudioAdapter,
  SmartChatModelOllamaAdapter,
  SmartChatModelOpenaiAdapter,
  SmartChatModelOpenRouterAdapter,
  SmartChatModelDeepseekAdapter,
} from "smart-chat-model/adapters.js";
import { SmartHttpRequest, SmartHttpObsidianRequestAdapter } from "smart-http-request";
import { requestUrl } from "obsidian";
import { 
  SmartThreads,
  SmartMessages,
  SmartMessage
} from "../smart-chat-v0/index.js";
import { SmartThread } from "../smart-chat-v0/sc_thread.js";
import { render as thread_component } from '../smart-chat-v0/components/thread.js';
import { EnvJsonThreadSourceAdapter } from "../smart-chat-v0/adapters/json.js";
// import { SmartEmbedOllamaAdapter } from "smart-embed-model/adapters/ollama.js";
import { render as source_inspector_component } from 'obsidian-smart-env/src/components/source_inspector.js';

// actions architecture
import smart_block from "smart-blocks/smart_block.js";
import smart_source from "smart-sources/smart_source.js";

export const smart_env_config = {
  env_path: '',
  // env_data_dir: '.smart-env', // added in Plugin class
  collections: {
    smart_sources: {
      process_embed_queue: true, // trigger embedding on load
    },
    smart_collections: {
      data_adapter: AjsonMultiFileCollectionDataAdapter
    },
    smart_threads: {
      class: SmartThreads,
      data_adapter: AjsonMultiFileCollectionDataAdapter,
      // data_adapter: CollectionDataAdapter,
      source_adapters: {
        "json": EnvJsonThreadSourceAdapter,
        "default": EnvJsonThreadSourceAdapter,
      },
    },
    smart_messages: {
      class: SmartMessages,
    },
  },
  item_types: {
    SmartThread,
    SmartMessage,
  },
  items: {
    smart_block,
    smart_source,
  },
  modules: {
    smart_chat_model: {
      class: SmartChatModel,
      // DEPRECATED FORMAT: will be changed (requires SmartModel adapters getters update)
      adapters: {
        anthropic: SmartChatModelAnthropicAdapter,
        azure: SmartChatModelAzureAdapter,
        // cohere: SmartChatModelCohereAdapter,
        custom: SmartChatModelCustomAdapter,
        google: SmartChatModelGoogleAdapter,
        gemini: SmartChatModelGeminiAdapter,
        groq: SmartChatModelGroqAdapter,
        lm_studio: SmartChatModelLmStudioAdapter,
        ollama: SmartChatModelOllamaAdapter,
        open_router: SmartChatModelOpenRouterAdapter,
        openai: SmartChatModelOpenaiAdapter,
        deepseek: SmartChatModelDeepseekAdapter,
      },
      http_adapter: new SmartHttpRequest({
        adapter: SmartHttpObsidianRequestAdapter,
        obsidian_request_url: requestUrl,
      }),
    },
    smart_fs: {
      class: SmartFs,
      adapter: SmartFsObsidianAdapter,
    },
    // smart_view: {
    //   class: SmartView,
    //   adapter: SmartViewObsidianAdapter,
    // },
  },
  components: {
    lookup: lookup_component,
    connections_results: results_component,
    smart_chat: smart_chat_component,
    connections: connections_component,
    source_inspector: source_inspector_component,
    smart_sources: {
      // settings: source_settings_component,
      connections: connections_component,
    },
    smart_blocks: {
      connections: connections_component,
    },
    smart_threads: {
      settings: collection_settings_component,
      thread: thread_component,
    },
    smart_chat_model: {
      settings: model_settings_component,
    },
  },
  default_settings: {
    is_obsidian_vault: true,
    smart_blocks: {
      embed_blocks: true,
      min_chars: 200,
    },
    smart_sources: {
      single_file_data_path: '.smart-env/smart_sources.json',
      min_chars: 200,
      embed_model: {
        adapter: "transformers",
        transformers: {
          legacy_transformers: false,
          model_key: 'TaylorAI/bge-micro-v2',
        },
      },
      excluded_headings: '',
      file_exclusions: 'Untitled',
      folder_exclusions: '',
    },
    smart_view_filter: {
      render_markdown: true,
      show_full_path: false,
      exclude_blocks_from_source_connections: false,
      exclude_frontmatter_blocks: true,
    },
  },
};
