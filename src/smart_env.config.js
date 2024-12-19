import { SmartSources, SmartSource } from "smart-sources";
import { SmartBlocks, SmartBlock } from "smart-blocks";
import { SourceAdapter } from "smart-sources/adapters/_adapter.js";
import { MarkdownSourceAdapter } from "smart-sources/adapters/markdown.js";
import { MarkdownBlockContentAdapter } from "smart-blocks/adapters/markdown_block.js";
import { MarkdownSourceContentAdapter } from "smart-sources/adapters/markdown_source.js";
import { AjsonMultiFileCollectionDataAdapter } from "smart-collections/adapters/ajson_multi_file.js";
// import { JsonSingleFileCollectionDataAdapter } from "smart-collections/adapters/json_single_file.js";
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
import { render as collection_settings_component } from 'smart-collections/components/settings.js';
import { render as model_settings_component } from "smart-model/components/settings.js";
import { render as render_directories_component } from "smart-directories/components/directories.js";
import { render as env_settings_component } from './components/env_settings.js';
import { render as connections_component } from './components/connections.js';
import { render as lookup_component } from './components/lookup.js';
import { render as results_component } from 'smart-entities/components/results.js';
import { render as result_component } from 'smart-entities/components/result.js';
import { AjsonMultiFileSourcesDataAdapter } from "smart-sources/adapters/data/ajson_multi_file.js";
// import { SmartViewNodeAdapter } from 'smart-view/adapters/node.js';
import { SmartChatModel } from "smart-chat-model";
import {
  SmartChatModelAnthropicAdapter,
  SmartChatModelOpenaiAdapter,
  SmartChatModelGeminiAdapter,
  SmartChatModelCohereAdapter,
  SmartChatModelOpenRouterAdapter,
  SmartChatModelCustomAdapter,
  SmartChatModelOllamaAdapter,
  SmartChatModelLmStudioAdapter,
  SmartChatModelGroqAdapter,
} from "smart-chat-model/adapters.js";
import { SmartHttpRequest, SmartHttpObsidianRequestAdapter } from "smart-http-request";
import { requestUrl } from "obsidian";
import { SmartDirectories, SmartDirectory } from "smart-directories";
import { SmartThreads } from "smart-chats/smart_threads.js";
// import { SmartThread } from "smart-chats/smart_thread.js";
import { ScThread as SmartThread } from "./sc_thread.js";
import { SmartMessages } from "smart-chats/smart_messages.js";
import { SmartMessage } from "smart-chats/smart_message.js";
import { EnvJsonThreadSourceAdapter } from "smart-chats/adapters/json.js";

export const smart_env_config = {
  global_ref: window,
  env_path: '',
  // env_data_dir: '.smart-env', // added in Plugin class
  collections: {
    smart_collections: {
      data_adapter: AjsonMultiFileCollectionDataAdapter
    },
    smart_sources: {
      class: SmartSources,
      data_adapter: AjsonMultiFileSourcesDataAdapter,
      // data_adapter: JsonSingleFileCollectionDataAdapter,
      source_adapters: {
        // "md": MarkdownSourceAdapter,
        // "txt": MarkdownSourceAdapter, // temp
        // "canvas": MarkdownSourceAdapter, // temp
        "md": MarkdownSourceContentAdapter,
        "txt": MarkdownSourceContentAdapter,
        "canvas": MarkdownSourceContentAdapter,
        "default": SourceAdapter,
      },
    },
    smart_blocks: {
      class: SmartBlocks,
      block_adapters: {
        "md": MarkdownBlockContentAdapter,
        "txt": MarkdownBlockContentAdapter,
        "canvas": MarkdownBlockContentAdapter,
      },
    },
    smart_directories: {
      class: SmartDirectories,
    },
    smart_threads: {
      class: SmartThreads,
      data_adapter: AjsonMultiFileCollectionDataAdapter,
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
    SmartSource,
    SmartBlock,
    SmartDirectory,
    SmartThread,
    SmartMessage,
  },
  modules: {
    smart_chat_model: {
      class: SmartChatModel,
      adapters: {
        openai: SmartChatModelOpenaiAdapter,
        anthropic: SmartChatModelAnthropicAdapter,
        // cohere: SmartChatModelCohereAdapter,
        gemini: SmartChatModelGeminiAdapter,
        open_router: SmartChatModelOpenRouterAdapter,
        custom: SmartChatModelCustomAdapter,
        ollama: SmartChatModelOllamaAdapter,
        lm_studio: SmartChatModelLmStudioAdapter,
        groq: SmartChatModelGroqAdapter,
      },
      http_adapter: new SmartHttpRequest({
        adapter: SmartHttpObsidianRequestAdapter,
        obsidian_request_url: requestUrl,
      }),
    },
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
    connections: connections_component,
    lookup: lookup_component,
    results: results_component,
    // result: result_component,
    smart_env: {
      settings: env_settings_component,
    },
    smart_sources: {
      settings: source_settings_component,
    },
    smart_blocks: {
      settings: source_settings_component,
    },
    smart_threads: {
      settings: collection_settings_component,
    },
    smart_directories: {
      directories: render_directories_component,
    },
    smart_chat_model: {
      settings: model_settings_component,
    },
    smart_embed_model: {
      settings: model_settings_component,
    },
  },
  default_settings: {
    is_obsidian_vault: true,
    smart_blocks: {
      embed_blocks: true,
    },
    smart_sources: {
      single_file_data_path: '.smart-env/smart_sources.json',
      embed_model: {
        adapter: "transformers",
        transformers: {
          legacy_transformers: false,
          model_key: 'TaylorAI/bge-micro-v2',
        },
      },
    },
    file_exclusions: 'Untitled',
    folder_exclusions: 'smart-chats',
    smart_view_filter: {
      render_markdown: true,
      show_full_path: false,
    },
  },
};
