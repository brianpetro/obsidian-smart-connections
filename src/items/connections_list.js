import { CollectionItem } from 'smart-collections';
import { results_acc } from 'smart-utils/results_acc.js';
import { sort_by_score_descending } from 'smart-utils/sort_by_score.js';
import { merge_pinned_results } from '../utils/merge_pinned_results.js';
import { migrate_hidden_connections } from '../../migrations/migrate_hidden_connections.js';

export class ConnectionsList extends CollectionItem {
  static key = 'connections_list';
  static get defaults() {
    return { data: {} };
  }

  get_key() {
    return `${this.data.collection_key}:${this.data.item_key}`;
  }

  async pre_process (params) {
    migrate_hidden_connections(this.item); // TEMP: migrate hidden connections if needed
    // default pre_process (via src/actions/connections-list/pre_process.js)
    if(typeof this.actions.connections_list_pre_process === 'function') {
      await this.actions.connections_list_pre_process(params);
    }
    // if score algo exports pre_process, call it
    if(typeof this.env.config?.actions?.[params.score_algo_key]?.pre_process === 'function') {
      await this.env.config.actions[params.score_algo_key].pre_process.call(this.item, params);
    }
    // console.log('ConnectionsList.pre_process params:', params);
  }

  /**
   * Produce ranked connections for the current source item.
   * @param {object} params
   * @note cannot call with different params until promise resolves
   * @returns {Promise<Array>}
   */
  async get_results (params = {}) {
    // clear if promise is resolved (allows for re-fetching with different params)
    if (this._results_promise) return this._results_promise; // cache promise to prevent duplicate calls
    const p = this._get_results(params);
    this._results_promise = p;
    this._results_promise.finally(() => {
      if (this._results_promise === p) {
        this._results_promise = null; // clear promise once resolved/rejected
      }
    });
    return this._results_promise;
  }

  async _get_results (params = {}) {
    // Pre-process params
    await this.pre_process(params);
    
    // Main filtering and scoring
    // Measure only filter_and_score so WASM and JS retrieval paths are comparable.
    const start_ms = Date.now();
    let results = this.filter_and_score(params);
    const end_ms = Date.now();
    // Post-process if needed
    results = await this.post_process(results, params);
    results = merge_pinned_results(results, params);

    results = results.map(r => Object.assign(r, {connections_list: this}));
    this.results = results; // cache for access via this downstream
    this.emit_event('connections:get_results', {
      elapsed_ms: end_ms - start_ms,
    });
    return results;
  }

  filter_and_score (params = {}) {
    const collection = this.env[params.results_collection_key];
    if (!collection?.items) return [];

    const source_item = params.to_item || this.item;
    const desired_limit = normalize_limit(
      params.limit,
      normalize_limit(this.settings?.results_limit, 20)
    );

    // fast path: similarity scores in wasm, then apply JS-side filters to the ranked slice
    if (
      source_item?.vec?.length
    ) {
      const file_info = collection.embeddings?.get_active_file_info();
      const file_name = file_info?.file;
      const total_candidates = collection.embeddings._persisted_lengths_by_file[file_name]/collection.embeddings.dims;

      if (total_candidates > 0) {
        let requested_k = Math.min(
          total_candidates,
          Math.max(desired_limit * 4, desired_limit + 25, 50)
        );

        while (true) {
          const top_k = collection.actions.top_k({
            vec: source_item.vec,
            k: requested_k,
          });
          
          const results = [];
          const score_errors = [];

          top_k.forEach(({item, score}) => {
            const target = item;
            if (target === source_item) return;
            if (target.key && source_item?.key && target.key === source_item.key) return;
            if (target.filter(params.filter) === false) return;
            if (params.score_algo_key !== 'similarity') {
              const scored = target.score({ ...params, to_item_similarity: score });
              if (!scored?.score) {
                if (scored?.error) score_errors.push(scored);
              }
              results.push(scored);
              return;
            }
            results.push({ score, item: target });
          });

          if (results.length >= desired_limit || requested_k >= total_candidates) {
            if (score_errors.length) {
              console.warn('Score errors:', score_errors);
            }
            return normalize_similarity_scores(results.sort(sort_by_score_descending).slice(0, desired_limit));
          }

          requested_k = Math.min(total_candidates, requested_k * 2);
        }
      }
    }
    return [];
  }

  async post_process (results, params = {}) {
    if(!results?.length) {
      console.warn('No results to post-process, received:', results);
      return [];
    }
    const action_key = this.settings.connections_post_process;
    const post_process_action = this.actions[action_key];
    let processed_results = results;
    if (typeof post_process_action === 'function') {
      const response = await post_process_action(results, params);
      if (Array.isArray(response)) {
        processed_results = response.filter(Boolean);
        if (!processed_results.length) processed_results = results;
      } else if (response !== undefined && response !== null) {
        console.warn(`connections post_process '${action_key}' returned non-array`, response);
      }
    } else if (action_key && action_key !== 'none') {
      console.warn(`Post-process action "${action_key}" not found, falling back to base results.`);
    }
    return processed_results;
  }
  get item () {
    return this.env[this.data.collection_key]?.items[this.data.item_key];
  }
  get connections_list_component_key () {
    const stored_key = this.data.connections_list_component_key
      || this.settings?.connections_list_component_key
    ;
    if(this.env.config.components[stored_key]) return stored_key;
    return 'connections_list_v4'; // TEMP default
  }

}

function normalize_limit(limit, fallback = 20) {
  const numeric_limit = Number(limit);
  if (Number.isFinite(numeric_limit) && numeric_limit > 0) {
    return Math.floor(numeric_limit);
  }
  return fallback;
}
// TODO: 2026-04-13 remove this normailization (only applies to custom algos anyway) 
function normalize_similarity_scores(results = []) {
  if (!results.length) return results;
  if (results.some((result) => result.score > 0.5)) return results;
  if (!results.some((result) => result.score > 0)) return results;

  while (!results.some((result) => result.score > 0.5)) {
    results.forEach((result) => {
      result.score *= 2;
    });
  }

  return results;
}