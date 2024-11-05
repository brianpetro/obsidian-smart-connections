import { render as render_results } from "./results.js";
/**
 * Builds the HTML string for the component.
 * @param {Object} scope - The scope object containing component data.
 * @param {Object} [opts={}] - Optional parameters for customizing the build process.
 * @returns {Promise<string>} A promise that resolves to the HTML string.
 */
export async function build_html(scope, opts = {}) {
  return `<div id="sc-search-view">
    <div class="sc-top-bar">
      <button class="sc-fold-toggle">${this.get_icon_html(scope.settings.expanded_view ? 'fold-vertical' : 'unfold-vertical')}</button>
      <button class="sc-search">${this.get_icon_html('search')}</button>
    </div>
    <div class="sc-search-container">
      <h2>Smart Lookup</h2>
      <div class="sc-search-input">
        <textarea
          id="query"
          name="query"
          placeholder="Describe what you're looking for (e.g., 'PKM strategies', 'story elements', 'personal AI alignment')"
        ></textarea>
        <button id="search">${this.get_icon_html('search')}</button>
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
 * @param {Object} scope - should be `env` instance
 * @param {Object} [opts={}] - Optional parameters for customizing the render process.
 * @param {String} [opts.collection_key] - The key of the collection to search.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the processed document fragment.
 */
export async function render(scope, opts = {}) {
  let html = await build_html.call(this, scope, opts);
  const frag = this.create_doc_fragment(html);
  return await post_process.call(this, scope, frag, opts);
}

/**
 * Post-processes the rendered document fragment, adding event listeners and performing other necessary operations.
 * @param {Object} scope - The scope object containing component data.
 * @param {DocumentFragment} frag - The document fragment to be post-processed.
 * @param {Object} [opts={}] - Optional parameters for customizing the post-processing.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the post-processed document fragment.
 */
export async function post_process(scope, frag, opts = {}) {
  const query_input = frag.querySelector('#query');
  const results_container = frag.querySelector('.sc-list');
  const render_search = async (search_text, results_container) => {
    const results = await scope[opts.collection_key].lookup({ hypotheticals: [search_text] });
    results_container.innerHTML = ''; // Clear previous results
    const results_frag = await render_results.call(this, scope, { ...opts, results });
    Array.from(results_frag.children).forEach((elm) => results_container.appendChild(elm));
  }
  if(opts.search_text){
    query_input.value = opts.search_text;
    await render_search(opts.search_text, results_container);
  }
  
  const search_button = frag.querySelector('#search');
  search_button.addEventListener('click', async (event) => {
    const container = event.target.closest('#sc-search-view');
    const search_text = query_input.value.trim();
    if (search_text) {
      await render_search(search_text, results_container);
    }
  });

  // Fold toggle functionality
  const fold_toggle = frag.querySelector('.sc-fold-toggle');
  fold_toggle.addEventListener('click', (event) => {
    const container = event.target.closest('#sc-search-view');
    const expanded = scope.settings.expanded_view;
    container.querySelectorAll(".search-result").forEach((elm) => {
      if (expanded) {
        elm.classList.add("sc-collapsed");
      } else {
        elm.classList.remove("sc-collapsed");
        const collection_key = elm.dataset.collection;
        const entity = scope[collection_key].get(elm.dataset.path);
        entity.render_item(elm.querySelector("li"));
      }
    });
    scope.settings.expanded_view = !expanded;
    fold_toggle.innerHTML = this.get_icon_html(scope.settings.expanded_view ? 'fold-vertical' : 'unfold-vertical');
  });
  return frag;

}