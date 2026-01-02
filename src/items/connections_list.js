import { CollectionItem } from 'smart-collections';
import { results_acc } from 'smart-utils/results_acc.js';
import { sort_by_score_descending } from 'smart-utils/sort_by_score.js';
import { merge_pinned_results } from '../utils/merge_pinned_results.js';
import { migrate_hidden_connections } from '../../migrations/migrate_hidden_connections.js';
import { filter_same_folder_results } from '../utils/filter_same_folder_results.js';

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
   * @returns {Promise<Array>}
   */
  async get_results (params = {}) {
    // Pre-process params
    await this.pre_process(params);
    // Main filtering and scoring
    let results = this.filter_and_score(params);
    // Post-process if needed
    results = await this.post_process(results, params);
    results = merge_pinned_results(results, params);

    results = results.map(r => Object.assign(r, {connections_list: this}));
    this.results = results; // cache for access via this downstream
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
