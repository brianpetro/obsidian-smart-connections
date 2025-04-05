import {
  SmartEmbedModelApiAdapter,
  SmartEmbedModelRequestAdapter,
  SmartEmbedModelResponseAdapter,
} from "./_api.js";
import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "../cl100k_base.json" with { type: "json" };

/**
 * Adapter for Google Gemini's embedding API
 * Handles token counting and API communication for Gemini models
 * @extends SmartEmbedModelApiAdapter
 */
export class SmartEmbedGeminiAdapter extends SmartEmbedModelApiAdapter {
  static defaults = {
    adapter: 'gemini',
    description: 'Google Gemini (API)',
    default_model: 'embedding-001',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/embedding-001:embedContent',
  };

  /**
   * Create Gemini adapter instance
   * @param {SmartEmbedModel} smart_embed - Parent model instance
   */
  constructor(smart_embed) {
    super(smart_embed);
    /** @type {Tiktoken|null} Tokenizer instance */
    this.enc = null;

    // Override the embed method to handle batch processing
    const originalEmbed = this.embed.bind(this);
    this.embed = async function(inputs, options = {}) {
      // If batch size is more than 1 and we have multiple inputs, handle it with our batch method
      if (Array.isArray(inputs) && inputs.length > 1) {
        return await this.batch_embed(inputs, options);
      }

      // Otherwise use the original embed method
      return await originalEmbed(inputs, options);
    }.bind(this);
  }

  /**
   * Process inputs in batches
   * @param {Array<string>} inputs - Array of texts to embed
   * @param {Object} options - Embedding options
   * @returns {Promise<Array<Object>>} Embedding results
   */
  async batch_embed(inputs, options = {}) {
    console.log(`Gemini batch embedding ${inputs.length} inputs`);

    // The actual batch processing is handled in the request/response adapters
    // This method simply passes the array of inputs to the embed method
    return await super.embed(inputs, options);
  }

  /**
   * Initialize tokenizer
   * @returns {Promise<void>}
   */
  async load() {
    this.enc = new Tiktoken(cl100k_base);
    // Note: Ideally we'd use a Gemini-specific tokenizer, but for now
    // we're using the same tokenizer as OpenAI for approximation
  }

  /**
   * Count tokens in input text using tokenizer
   * @param {string} input - Text to tokenize
   * @returns {Promise<Object>} Token count result
   */
  async count_tokens(input) {
    if (!this.enc) await this.load();
    return { tokens: this.enc.encode(input).length };
  }

  /**
   * Prepare input text for embedding
   * Handles token limit truncation
   * @param {string} embed_input - Raw input text
   * @returns {Promise<string|null>} Processed input text
   */
  async prepare_embed_input(embed_input) {
    if (typeof embed_input !== "string") {
      throw new TypeError("embed_input must be a string");
    }

    if (embed_input.length === 0) {
      console.log("Warning: prepare_embed_input received an empty string");
      return null;
    }

    const { tokens } = await this.count_tokens(embed_input);
    if (tokens <= this.max_tokens) {
      return embed_input;
    }

    return await this.trim_input_to_max_tokens(embed_input, tokens);
  }

  /**
   * Trim input text to fit token limit
   * @private
   * @param {string} embed_input - Input text to trim
   * @param {number} tokens_ct - Current token count
   * @returns {Promise<string|null>} Trimmed input text
   */
  async trim_input_to_max_tokens(embed_input, tokens_ct) {
    const reduce_ratio = (tokens_ct - this.max_tokens) / tokens_ct;
    const new_length = Math.floor(embed_input.length * (1 - reduce_ratio));
    let trimmed_input = embed_input.slice(0, new_length);
    const last_space_index = trimmed_input.lastIndexOf(" ");
    if (last_space_index > 0) {
      trimmed_input = trimmed_input.slice(0, last_space_index);
    }
    const prepared_input = await this.prepare_embed_input(trimmed_input);
    if (prepared_input === null) {
      console.log(
        "Warning: prepare_embed_input resulted in an empty string after trimming"
      );
      return null;
    }
    return prepared_input;
  }

  /**
   * Get the request adapter class.
   * @returns {SmartEmbedGeminiRequestAdapter} The request adapter class
   */
  get req_adapter() {
    return SmartEmbedGeminiRequestAdapter;
  }

  /**
   * Get the response adapter class.
   * @returns {SmartEmbedGeminiResponseAdapter} The response adapter class
   */
  get res_adapter() {
    return SmartEmbedGeminiResponseAdapter;
  }

  /** @returns {number} Maximum tokens per input */
  get max_tokens() {
    return this.model_config.max_tokens || 3072;
  }

  /** @returns {Object} Settings configuration for Gemini adapter */
  get settings_config() {
    return {
      ...super.settings_config,
      "[ADAPTER].api_key": {
        name: "Google API Key for Gemini embeddings",
        type: "password",
        description: "Required for Gemini embedding models",
        placeholder: "Enter Google API Key",
      },
      "[ADAPTER].task_type": {
        name: "Task Type",
        type: "select",
        description: "The intended task for the embeddings",
        options: {
          "RETRIEVAL_DOCUMENT": "Retrieval Document",
          "RETRIEVAL_QUERY": "Retrieval Query",
          "SEMANTIC_SIMILARITY": "Semantic Similarity",
          "CLASSIFICATION": "Classification",
          "CLUSTERING": "Clustering"
        },
        default: "RETRIEVAL_DOCUMENT"
      }
    };
  }

  /**
   * Get available models (hardcoded list)
   * @returns {Promise<Object>} Map of model objects
   */
  get_models() {
    return Promise.resolve(this.models);
  }

  get models() {
    return {
      "embedding-001": {
        "id": "embedding-001",
        "batch_size": 1, // Gemini API might not support batch processing in the same way
        "dims": 768,
        "max_tokens": 3072,
        "name": "Gemini Embedding",
        "description": "API, 3,072 tokens, 768 dim",
        "endpoint": "https://generativelanguage.googleapis.com/v1/models/embedding-001:embedContent",
        "adapter": "gemini"
      },
    };
  }
}

/**
 * Request adapter for Gemini embedding API
 * @class SmartEmbedGeminiRequestAdapter
 * @extends SmartEmbedModelRequestAdapter
 */
class SmartEmbedGeminiRequestAdapter extends SmartEmbedModelRequestAdapter {
  /**
   * Prepare request body for Gemini API
   * @returns {Object} Request body for API
   */
  prepare_request_body() {
    // Gemini doesn't support batch inputs in the same request format as OpenAI
    // For our adapter interface, we'll handle the first input and later implement batch processing

    // Check if we're dealing with a batch or single input
    const isBatch = Array.isArray(this.embed_inputs);
    const input = isBatch ? this.embed_inputs[0] : this.embed_inputs;

    // Store the information that we have multiple inputs to process
    if (isBatch && this.embed_inputs.length > 1) {
      this._hasBatchInputs = true;
      this._batchInputs = this.embed_inputs;
      this._currentBatchIndex = 0;
    }

    const taskType = this.adapter.settings.get("[ADAPTER].task_type") || "RETRIEVAL_DOCUMENT";

    return {
      content: {
        parts: [
          { text: input }
        ]
      },
      taskType: taskType,
      // Optional title can be used if available
      title: this.adapter.settings.get("[ADAPTER].title") || undefined
    };
  }

  /**
   * Prepare request options, adding the API key as query parameter
   * @param {Object} options - The request options
   * @returns {Object} Modified request options
   */
  prepare_request_options(options) {
    const api_key = this.adapter.settings.get("[ADAPTER].api_key");

    if (!api_key) {
      throw new Error("Google API Key is required for Gemini embeddings");
    }

    // Add API key as query parameter
    const url = new URL(options.url);
    url.searchParams.append("key", api_key);
    options.url = url.toString();

    return options;
  }
}

/**
 * Response adapter for Gemini embedding API
 * @class SmartEmbedGeminiResponseAdapter
 * @extends SmartEmbedModelResponseAdapter
 */
class SmartEmbedGeminiResponseAdapter extends SmartEmbedModelResponseAdapter {
  /**
   * Parse Gemini API response
   * @returns {Array<Object>} Parsed embedding results
   */
  parse_response() {
    const resp = this.response;

    if (!resp || !resp.embedding || !resp.embedding.values) {
      console.error("Invalid Gemini embedding response format", resp);
      return [];
    }

    // Extract token count if available in statistics
    const tokenCount = resp.embedding.statistics?.tokenCount || 0;

    // If this is part of a batch, store it in our batch results
    if (this.request_adapter._hasBatchInputs) {
      // Initialize batch results array if needed
      if (!this._batchResults) {
        this._batchResults = [];
      }

      // Add this result to our batch
      this._batchResults.push({
        vec: resp.embedding.values,
        tokens: tokenCount
      });

      // Increment the batch index
      this.request_adapter._currentBatchIndex++;

      // If we have more inputs to process
      if (this.request_adapter._currentBatchIndex < this.request_adapter._batchInputs.length) {
        // Process the next input
        const nextInput = this.request_adapter._batchInputs[this.request_adapter._currentBatchIndex];

        // Set up the next request
        setTimeout(() => {
          this.request_adapter.embed_inputs = nextInput;
          const newBody = this.request_adapter.prepare_request_body();
          // Trigger another request with the same adapter instances but new body
          this.adapter.embed_with_api(newBody, this.request_adapter, this);
        }, 0);

        // Return empty array for now - we'll return the full batch when it's complete
        return [];
      }

      // If we're done with the batch, return all results
      return this._batchResults;
    }

    // For single inputs, just return the result
    return [{
      vec: resp.embedding.values,
      tokens: tokenCount
    }];
  }
}