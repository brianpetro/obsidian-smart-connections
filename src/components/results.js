import { render as render_result } from "./result.js";
/**
 * Builds the HTML string for the .sc-list fragment.
 * @param {Object} scope - The scope object containing component data.
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<string>} A promise that resolves to the .sc-list HTML string.
 */
export async function build_html(scope, opts = {}) {
  return ``;
}

/**
 * Renders the .sc-list fragment by creating and appending child elements.
 * @param {Object} scope - The scope object containing component data.
 * @param {Object} [opts={}] - Optional parameters, including `opts.results`.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the .sc-list fragment with appended children.
 */
export async function render(scope, opts = {}) {
  const html = await build_html.call(this, scope, opts);
  const frag = this.create_doc_fragment(html);
  
  const results = opts.results || []; // Use passed-in results
  const result_frags = await Promise.all(results.map(result => {
    return render_result.call(this, result, {...opts});
  }));
  result_frags.forEach(result_frag => frag.appendChild(result_frag));
  
  return frag;
}

/**
 * Post-processes the .sc-list fragment if needed.
 * @param {Object} scope - The scope object containing component data.
 * @param {DocumentFragment} frag - The .sc-list fragment to be post-processed.
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the post-processed fragment.
 */
export async function post_process(scope, frag, opts = {}) {
  // Add any necessary post-processing here
  return frag;
}