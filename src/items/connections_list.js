import { CollectionItem } from 'smart-collections';
import { results_acc } from 'smart-utils/results_acc.js';
import { sort_by_score_descending } from 'smart-utils/sort_by_score.js';
import { merge_pinned_results } from '../utils/merge_pinned_results.js';
import { migrate_hidden_connections } from '../../migrations/migrate_hidden_connections.js';
import { filter_same_folder_results } from '../utils/filter_same_folder_results.js';
import { filter_rootline_results } from '../utils/filter_rootline_results.js';

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
   * Produce ranked connections for the current source item with adaptive retry logic.
   * If folder filters are active and leave no results, automatically retries with
   * increasing boost multipliers until results are found or max boost is reached.
   * @param {object} params
   * @returns {Promise<Array>}
   */
  async get_results (params = {}) {
    const base_limit = params.limit || this.settings?.results_limit || 20;
    const exclude_same_folder = this.settings?.exclude_same_folder ?? false;
    const exclude_rootline = this.settings?.exclude_rootline ?? false;
    
    // Get configured boost multipliers
    const same_folder_multiplier = this.settings?.same_folder_boost_multiplier ?? 1.5;
    const rootline_multiplier = this.settings?.rootline_boost_multiplier ?? 2.0;
    const max_multiplier = this.settings?.max_boost_multiplier ?? 10.0;
    
    // Only use retry logic if folder filters are active
    const filters_active = exclude_same_folder || exclude_rootline;
    
    if (!filters_active) {
      // No filters active, use standard logic with base_limit
      const results = await this._get_results_single_attempt(params, base_limit);
      return results.slice(0, base_limit);
    }
    
    // Adaptive retry logic for when filters are active
    const MAX_RETRIES = 5;
    let attempt = 0;
    let current_additional_boost = 1.0;
    let results = [];
    
    while (results.length === 0 && attempt < MAX_RETRIES) {
      // Calculate total boost for this attempt
      let total_boost = current_additional_boost;
      if (exclude_same_folder) total_boost *= same_folder_multiplier;
      if (exclude_rootline) total_boost *= rootline_multiplier;
      
      // Cap at max_multiplier
      total_boost = Math.min(total_boost, max_multiplier);
      
      const boosted_limit = Math.ceil(base_limit * total_boost);
      
      // Attempt to get results with current boost
      results = await this._get_results_single_attempt(params, boosted_limit);
      
      // If no results and haven't reached max boost, increase and retry
      if (results.length === 0 && total_boost < max_multiplier) {
        current_additional_boost *= 1.5; // Increase boost by 50% for next attempt
        attempt++;
      } else {
        break; // Got results or reached max boost
      }
    }
    
    // Limit to original base_limit
    return results.slice(0, base_limit);
  }

  /**
   * Internal method to get results with a specific limit (single attempt, no retry).
   * @param {object} params
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async _get_results_single_attempt (params, limit) {
    const boosted_params = { ...params, limit };
    
    await this.pre_process(boosted_params);
    
    let results = this.filter_and_score(boosted_params);
    
    results = await this.post_process(results, boosted_params);
    results = merge_pinned_results(results, boosted_params);

    results = results.map(r => Object.assign(r, {connections_list: this}));
    this.results = results;
    return results;
  }

  filter_and_score (params = {}) {
    const collection = this.env[params.results_collection_key];
    const score_errors = [];
    const { results: raw_results } = Object.values(collection.items)
      .reduce((acc, target) => {
        const scored = target.filter_and_score(params);
        if(!scored?.score){
          if(scored?.error) score_errors.push(scored.error);
          return acc; // skip if errored/filtered out
        }
        results_acc(acc, scored, params.limit); // update acc
        return acc;
      }, { min: 0, results: new Set() })
    ;
    let results = Array.from(raw_results).sort(sort_by_score_descending);
    if(!results.length) return results;
    
    const exclude_same_folder = this.settings?.exclude_same_folder ?? false;
    results = filter_same_folder_results(results, this.item, exclude_same_folder);
    if(!results.length) return results;
    
    const exclude_rootline = this.settings?.exclude_rootline ?? false;
    results = filter_rootline_results(results, this.item, exclude_rootline);
    if(!results.length) return results;
    
    while(!results.some(r => r.score > 0.5)) {
      results.forEach(r => r.score *= 2);
    }
    return results;
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
    return 'connections_list_v3'; // TEMP default
  }

}