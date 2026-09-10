import { CollectionItem } from 'smart-collections';
import { sort_by_score_descending } from 'smart-utils/sort_by_score.js';
import { resolve_connection_feedback } from '../utils/connections_list_item_state.js';
import { copy_connections_filter } from '../utils/copy_connections_filter.js';

export class ConnectionsList extends CollectionItem {
  static key = 'connections_list';
  // Pair each raw snapshot with its preparation, including coalesced callers.
  // Weak keys avoid retaining results after their presenters release them.
  _result_params = new WeakMap();
  static get defaults() {
    return { data: {} };
  }

  get_key() {
    return `${this.data.collection_key}:${this.data.item_key}`;
  }

  async pre_process (params) {
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
    if (this._results_promise) return this._results_promise;
    const pending = this._get_results(params);
    this._results_promise = pending;
    try {
      return await pending;
    } finally {
      if (this._results_promise === pending) this._results_promise = null;
    }
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
    // Ranking may reorder the window, but cannot widen eligibility or its limit.
    results = results.filter(result => this.is_candidate_eligible(result.item, params))
      .slice(0, normalize_limit(params.limit, normalize_limit(this.settings?.results_limit, 20)));

    results = results.map(r => Object.assign(r, {
      connections_list: this,
      feedback: resolve_connection_feedback(this.item, r.item),
    }));
    this._result_params.set(results, {
      ...params,
      filter: copy_connections_filter(params.filter),
    });
    this.results = results; // cache for access via this downstream
    this.emit_event('connections:get_results', {
      elapsed_ms: end_ms - start_ms,
    });
    return results;
  }

  /**
   * Test hard eligibility using prepared retrieval params, never feedback state.
   * @param {object} candidate_item
   * @param {object} params
   * @returns {boolean}
   */
  is_candidate_eligible(candidate_item, params = {}) {
    if (!candidate_item?.vec?.length) return false;
    const collection_key = params.results_collection_key || this.collection.results_collection_key;
    if (candidate_item.collection_key !== collection_key) return false;
    const target_item = params.to_item || this.item;
    if (candidate_item.key === target_item.key) return false;
    if (candidate_item.vec.length !== target_item.vec?.length) return false;
    return candidate_item.filter(params.filter) !== false;
  }

  /**
   * Resolve hard-eligible target feedback for presentation supplementation.
   * Call after retrieval/preprocessing so configured and workflow filters apply.
   * Does not score, order, or persist results.
   * @param {object} params - Prepared retrieval params.
   * @param {{states: Array<'pinned'|'hidden'>}} options
   * @returns {Array<{item: object, feedback: {state: string}}>}
   */
  get_feedback_items(params, { states }) {
    const items = [];
    for (const key of Object.keys(this.item.data?.connections || {})) {
      const separator = key.indexOf(':');
      if (separator < 1) continue;
      const collection_key = key.slice(0, separator);
      const item = this.env[collection_key]?.get(key.slice(separator + 1));
      if (!this.is_candidate_eligible(item, params)) continue;
      const feedback = resolve_connection_feedback(this.item, item);
      if (states.includes(feedback.state)) items.push({ item, feedback });
    }
    return items;
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
            if (!this.is_candidate_eligible(target, params)) return;
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
    const action_key = params.connections_post_process ?? this.settings.connections_post_process;
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