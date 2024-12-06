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
import { render as collection_settings_component } from 'smart-collections/components/settings.js';
import { render as env_settings_component } from './components/env_settings.js';
import { render as connections_component } from 'smart-entities/components/connections.js';
import { render as lookup_component } from 'smart-entities/components/lookup.js';
import { render as model_settings_component } from "smart-model/components/settings.js";
import { render as render_directories_component } from "smart-groups/components/directories.js";
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
} from "smart-chat-model/adapters.js";
import { SmartHttpRequest, SmartHttpObsidianRequestAdapter } from "smart-http-request";
import { requestUrl } from "obsidian";
import { SmartDirectories, SmartDirectory } from "smart-groups";
import { SmartThreads } from "smart-chats/smart_threads.js";
import { SmartThread } from "smart-chats/smart_thread.js";
import { SmartMessages } from "smart-chats/smart_messages.js";
import { SmartMessage } from "smart-chats/smart_message.js";
import { EnvJsonThreadSourceAdapter } from "smart-chats/adapters/json.js";

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
    },
    smart_blocks: {
      class: SmartBlocks,
    },
    smart_directories: {
      class: SmartDirectories,
    },
    smart_threads: {
      class: SmartThreads,
      data_adapter: SmartCollectionMultiFileDataAdapter,
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
    smart_env: {
      settings: env_settings_component,
    },
    smart_sources: {
      connections: connections_component,
      lookup: lookup_component,
      settings: source_settings_component,
    },
    smart_blocks: {
      connections: connections_component,
      lookup: lookup_component,
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
      embed_model: {
        model_key: 'TaylorAI/bge-micro-v2',
        legacy_transformers: true,
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
