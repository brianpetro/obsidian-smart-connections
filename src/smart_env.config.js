import {
  SmartSources,
  SmartBlocks,
  SmartSource,
  SmartBlock,
} from "./sc_entities.js";
import { SmartChunks } from 'smart-chunks/smart_chunks.js';
import { SmartEmbedModel } from "smart-embed-model";
import { SmartEmbedOpenAIAdapter } from "smart-embed-model/adapters/openai.js";
import { SmartEmbedTransformersIframeAdapter } from "smart-embed-model/adapters/transformers_iframe.js";
import { SmartFs } from 'smart-file-system/smart_fs.js';
import { SmartFsObsidianAdapter } from 'smart-file-system/adapters/obsidian.js';
import { SmartCollectionMultiFileDataAdapter } from "smart-collections/adapters/multi_file";

export const smart_env_config = {
  global_ref: window,
  env_path: '',
  env_data_dir: '.smart-env',
  collections: {
    smart_collections: {
      data_adapter: SmartCollectionMultiFileDataAdapter
    },
    SmartSources,
    SmartBlocks,
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
    smart_chunks: SmartChunks,
    smart_fs: {
      class: SmartFs,
      adapter: SmartFsObsidianAdapter,
    },
  },
};
