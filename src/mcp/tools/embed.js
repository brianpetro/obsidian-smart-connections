/**
 * Smart Connections Embed MCP Tool
 *
 * Generates embeddings using Smart Connections' exact embedding model
 * Direct access to plugin's embedding model instance
 */

export class SmartConnectionsEmbedTool {
  constructor(plugin) {
    this.plugin = plugin;
  }

  getToolDefinition() {
    return {
      name: "smart_connections_embed",
      description: "Generate embeddings using Smart Connections' TaylorAI/bge-micro-v2 model",
      inputSchema: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Text content to embed"
          },
          normalize: {
            type: "boolean",
            default: true,
            description: "Whether to normalize the embedding vector"
          }
        },
        required: ["content"]
      }
    };
  }

  async execute(args) {
    const { content, normalize = true } = args;

    // Validate plugin environment
    if (!this.plugin.env) {
      throw new Error('Smart Connections environment not ready. Please wait for plugin to fully load.');
    }

    if (!content || content.trim().length === 0) {
      throw new Error('Content cannot be empty');
    }

    try {
      // Access Smart Connections embedding model
      const embedModel = this.plugin.env.smart_embed_model;

      if (!embedModel) {
        throw new Error('Smart Connections embedding model not available');
      }

      // Check if model is loaded
      if (!embedModel.model_loaded) {
        // Try to load the model if not already loaded
        if (embedModel.load) {
          console.log('Loading Smart Connections embedding model...');
          await embedModel.load();
        } else {
          throw new Error('Embedding model not loaded and cannot be loaded');
        }
      }

      // Generate embedding using Smart Connections exact method
      const result = await embedModel.embed(content);

      // Handle different result formats that Smart Connections might return
      let embedding;
      if (result && result.vec) {
        embedding = result.vec;
      } else if (Array.isArray(result)) {
        embedding = result;
      } else {
        throw new Error('Unexpected embedding result format');
      }

      // Validate embedding
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Generated embedding is invalid');
      }

      return {
        embedding: embedding,
        model_info: {
          name: embedModel.model_name || 'TaylorAI/bge-micro-v2',
          dimensions: embedding.length,
          normalized: normalize,
        },
        content_info: {
          length: content.length,
          word_count: content.split(/\s+/).length,
          truncated: content.length > (embedModel.max_input_length || 8192),
        },
        plugin_info: {
          model_loaded: embedModel.model_loaded || false,
          model_path: embedModel.model_path || 'unknown',
        }
      };

    } catch (error) {
      console.error('Smart Connections embed error:', error);

      // Provide helpful error context
      const errorContext = {
        error: error.message,
        model_available: !!this.plugin.env?.smart_embed_model,
        model_loaded: this.plugin.env?.smart_embed_model?.model_loaded || false,
      };

      throw new Error(`Embedding failed: ${error.message} (Context: ${JSON.stringify(errorContext)})`);
    }
  }

  // Utility method to get model status
  getModelStatus() {
    if (!this.plugin.env) {
      return { status: 'env_not_ready' };
    }

    const embedModel = this.plugin.env.smart_embed_model;
    if (!embedModel) {
      return { status: 'model_not_available' };
    }

    return {
      status: embedModel.model_loaded ? 'loaded' : 'not_loaded',
      model_name: embedModel.model_name || 'unknown',
      model_path: embedModel.model_path || 'unknown',
      max_input_length: embedModel.max_input_length || 'unknown',
    };
  }
}