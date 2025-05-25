import { render as render_result } from "./connections_result.js";
/**
 * Builds the HTML string for the .sc-list fragment.
 * @param {Array} results - The results array.
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<string>} A promise that resolves to the .sc-list HTML string.
 */
export async function build_html(results, opts = {}) {
  return ``;
}

/**
 * Renders the .sc-list fragment by creating and appending child elements.
 * @param {Array} results - The results array.
 * @param {Object} [opts={}] - Optional parameters, including `opts.results`.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the .sc-list fragment with appended children.
 */
export async function render(results, opts = {}) {
  const html = await build_html.call(this, results, opts);
  const frag = this.create_doc_fragment(html);
  
  const result_frags = await Promise.all(results.map(result => {
    return result.item.env.render_component('connections_result', result, {...opts});
  }));
  result_frags.forEach(result_frag => frag.appendChild(result_frag));
  
  return frag;
}

/**
 * Post-processes the .sc-list fragment if needed.
 * @param {Array} results - The results array.
 * @param {DocumentFragment} frag - The .sc-list fragment to be post-processed.
 * @param {Object} [opts={}] - Optional parameters.
 * @returns {Promise<DocumentFragment>} A promise that resolves to the post-processed fragment.
 */
export async function post_process(results, frag, opts = {}) {
  // Add any necessary post-processing here
  return frag;
}