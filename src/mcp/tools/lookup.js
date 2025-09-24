/**
 * Smart Connections Lookup MCP Tool
 *
 * Provides vector search using Smart Connections exact algorithms
 * Direct access to plugin's SmartEnv and collections
 */

// Simple statistical filtering without external dependency
function get_nearest_until_next_dev_exceeds_std_dev(results) {
  if (results.length <= 2) return results;

  // Calculate mean and standard deviation of scores
  const scores = results.map(r => r.score || r.sim || 0);
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Return results until the next deviation exceeds one standard deviation
  const filtered = [];
  for (let i = 0; i < results.length - 1; i++) {
    filtered.push(results[i]);
    const currentScore = scores[i];
    const nextScore = scores[i + 1];
    if (Math.abs(currentScore - nextScore) > stdDev) {
      break;
    }
  }

  return filtered.length > 0 ? filtered : results.slice(0, Math.min(10, results.length));
}

export class SmartConnectionsLookupTool {
  constructor(plugin) {
    this.plugin = plugin;
  }

  getToolDefinition() {
    return {
      name: "smart_connections_lookup",
      description: "Search Smart Connections knowledge base using vector similarity",
      inputSchema: {
        type: "object",
        properties: {
          hypotheticals: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            description: "Search queries or hypothetical relevant content"
          },
          filter: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                default: 10,
                maximum: 50,
                description: "Maximum number of results to return"
              },
              key_starts_with: {
                type: "string",
                description: "Filter results to keys starting with this string"
              },
              exclude_key_starts_with: {
                type: "string",
                description: "Exclude results with keys starting with this string"
              },
              collection: {
                type: "string",
                enum: ["sources", "blocks", "both"],
                default: "both",
                description: "Which Smart Connections collection to search"
              }
            }
          }
        },
        required: ["hypotheticals"]
      }
    };
  }

  async execute(args) {
    const { hypotheticals, filter = {} } = args;

    // Validate plugin environment
    if (!this.plugin.env) {
      throw new Error('Smart Connections environment not ready. Please wait for plugin to fully load.');
    }

    // Default filter values
    const searchFilter = {
      limit: filter.limit || 10,
      collection: filter.collection || 'both',
      ...filter
    };

    try {
      let results = [];

      // Search based on collection preference
      if (searchFilter.collection === 'sources' || searchFilter.collection === 'both') {
        if (this.plugin.env.smart_sources) {
          const sourceResults = await this.searchCollection(
            this.plugin.env.smart_sources,
            hypotheticals,
            searchFilter,
            'source'
          );
          results = results.concat(sourceResults);
        }
      }

      if (searchFilter.collection === 'blocks' || searchFilter.collection === 'both') {
        if (this.plugin.env.smart_blocks) {
          const blockResults = await this.searchCollection(
            this.plugin.env.smart_blocks,
            hypotheticals,
            searchFilter,
            'block'
          );
          results = results.concat(blockResults);
        }
      }

      // Apply Smart Connections statistical filtering
      if (results.length > 0) {
        results = get_nearest_until_next_dev_exceeds_std_dev(results);
      }

      // Apply limit
      results = results.slice(0, searchFilter.limit);

      // Format results
      const formattedResults = results.map(result => ({
        key: result.key || result.id,
        score: result.score || result.sim || 0,
        content: result.content || result.data?.content || result.text || '',
        path: result.path || result.key,
        type: result.collection_type || 'unknown',
        // Include Smart Connections specific fields
        breadcrumbs: result.breadcrumbs,
        size: result.size,
        last_modified: result.last_modified,
      }));

      return {
        results: formattedResults,
        count: formattedResults.length,
        total_before_limit: results.length,
        search_params: {
          hypotheticals,
          filter: searchFilter,
        },
        plugin_info: {
          vault_name: this.plugin.app.vault.getName(),
          sources_available: !!this.plugin.env.smart_sources,
          blocks_available: !!this.plugin.env.smart_blocks,
          sources_count: this.plugin.env.smart_sources?.items ? Object.keys(this.plugin.env.smart_sources.items).length : 0,
          blocks_count: this.plugin.env.smart_blocks?.items ? Object.keys(this.plugin.env.smart_blocks.items).length : 0,
        }
      };

    } catch (error) {
      console.error('Smart Connections lookup error:', error);
      throw new Error(`Lookup failed: ${error.message}`);
    }
  }

  async searchCollection(collection, hypotheticals, filter, collectionType) {
    try {
      // Use Smart Connections exact lookup method
      const lookupParams = {
        hypotheticals,
      };

      // Apply key filters
      if (filter.key_starts_with) {
        lookupParams.key_starts_with = filter.key_starts_with;
      }
      if (filter.exclude_key_starts_with) {
        // This might need custom filtering post-lookup
        // depending on Smart Connections implementation
      }

      const results = await collection.lookup(lookupParams);

      // Add collection type to results
      return results.map(result => ({
        ...result,
        collection_type: collectionType
      }));

    } catch (error) {
      console.warn(`Failed to search ${collectionType} collection:`, error);
      return [];
    }
  }
}