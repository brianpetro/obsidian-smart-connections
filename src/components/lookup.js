/**
 * Build parameters for lookup requests.
 * @param {string} query - Hypothetical user query.
 * @param {Object} settings - Environment settings.
 * @param {Object} [filter] - Optional filter overrides.
 * @returns {Object} Params for collection.lookup.
 */
export const get_lookup_params = (query, settings, filter) => {
  const skip_blocks = settings.smart_view_filter?.exclude_blocks_from_source_connections;
  return {
    hypotheticals: [query],
    filter,
    ...(skip_blocks ? { skip_blocks: true } : {}),
  };
};

/**
 * Builds the HTML string for the component.
 * @param {Object} collection - The scope object containing component data.
 * @param {Object} [opts={}] - Optional parameters for customizing the build process.
 * @returns {Promise<string>} A promise that resolves to the HTML string.
 */
export async function build_html(collection, opts = {}) {
  const expanded_view = collection.env.settings.smart_view_filter?.expanded_view
    ?? collection.env.settings.expanded_view // @deprecated
  ;
  return `<div id="sc-lookup-view">
    <div class="sc-top-bar">
      <button class="sc-fold-toggle">${this.get_icon_html(expanded_view ? 'fold-vertical' : 'unfold-vertical')}</button>
    </div>
    <div class="sc-container">
      <h2>Smart Lookup</h2>
      <div class="sc-textarea-container">
        <textarea
          id="query"
          name="query"
          placeholder="Describe what you're looking for (e.g., 'PKM strategies', 'story elements', 'personal AI alignment')"
        ></textarea>
        <div class="sc-textarea-btn-container">
          <button class="send-button">${this.get_icon_html('search')}</button>
        </div>
      </div>
      <p>Use semantic (embeddings) search to surface relevant notes. Results are sorted by similarity to your query. Note: returns different results than lexical (keyword) search.</p>
    </div>
    <div class="sc-list">
    </div>
    <div class="sc-bottom-bar">
      ${opts.attribution || ''}
    </div>
  </div>`;
}

/**
 * Renders the component by building the HTML and post-processing it.
 * @param {Object} collection - should be `env` instance
 * @param {Object} [opts={}] - Optional parameters for customizing the render process.
 * @param {String} [opts.collection_key] - The key of the collection to search.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the processed document fragment.
 */
export async function render(collection, opts = {}) {
  let html = await build_html.call(this, collection, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, collection, frag, opts);
}

/**
 * Post-processes the rendered document fragment, adding event listeners and performing other necessary operations.
 * @param {Object} collection - The scope object containing component data.
 * @param {DocumentFragment} frag - The document fragment to be post-processed.
 * @param {Object} [opts={}] - Optional parameters for customizing the post-processing.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the post-processed document fragment.
 */
export async function post_process(collection, frag, opts = {}) {
  const query_input = frag.querySelector('#query');
  const results_container = frag.querySelector('.sc-list');
  const render_lookup = async (query, results_container) => {
    const lookup_params = get_lookup_params(query, collection.env.settings, opts.filter);
    const results = await collection.lookup(lookup_params);
    this.empty(results_container); // Clear previous results
    const results_frag = await collection.env.render_component('connections_results', results, opts);
    Array.from(results_frag.children).forEach((elm) => results_container.appendChild(elm));
  }
  
  // Add debounced auto-submit functionality
  let timeout;
  query_input.addEventListener('input', (event) => {
    clearTimeout(timeout);
    const query = event.target.value.trim();
    if (query) {
      timeout = setTimeout(async () => {
        await render_lookup(query, results_container);
      }, 500);
    }
  });

  if(opts.query){
    query_input.value = opts.query;
    await render_lookup(opts.query, results_container);
  }
  
  const send_button = frag.querySelector('.send-button');
  send_button.addEventListener('click', async (event) => {
    clearTimeout(timeout); // Clear any pending auto-submit
    const query = query_input.value.trim();
    if (query) {
      await render_lookup(query, results_container);
    }
  });

  const list_el = frag.querySelector('.sc-list');
  const connections_settings = opts.connections_settings
    ?? collection.env.settings.smart_view_filter
  ;
  const toggle_btn = frag.querySelector('.sc-fold-toggle');
  toggle_btn.addEventListener('click', () => {
    const expanded = connections_settings.expanded_view;
    connections_settings.expanded_view = !expanded;

    list_el.querySelectorAll('.sc-result').forEach((elm) =>
      expanded ? elm.classList.add('sc-collapsed') : elm.classList.remove('sc-collapsed')
    );

    this.safe_inner_html(
      toggle_btn,
      this.get_icon_html(expanded ? 'unfold-vertical' : 'fold-vertical')
    );
  });

  return frag;
}