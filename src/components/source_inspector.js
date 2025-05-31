 /**
  * Build raw HTML container. The detailed content for each block
  * will be appended in post_process (because block.read() is async).
  * @param {Object} source
  * @param {Object} [opts]
  * @returns {string}
  */
export function build_html(source, opts = {}) {
  return `
    <div class="smart-chat-message source-inspector">
      <h2>Blocks</h2>
      <div class="source-inspector-blocks-container"></div>
    </div>
  `;
}

import inspector_css from './source_inspector.css' with { type: 'css' };

/**
 * Render the component by:
 *   1. building the container HTML
 *   2. creating a DocumentFragment
 *   3. calling post_process to append each block
 *
 * @param {Object} data - expected to have data.note
 * @param {Object} [opts]
 * @returns {Promise<DocumentFragment>}
 */
export async function render(source, opts={}) {
  const html = build_html(source, opts);
  const frag = this.create_doc_fragment(html);
  this.apply_style_sheet(inspector_css);
  await post_process.call(this, source, frag, opts);
  return frag;
}

/**
 * Post-process: build the actual block listing, read each block, and inject.
 * This replicates the EJS logic:
 *   for each block => a short info line, plus a blockquote with escaped content.
 *
 * @param {Object} source - must have data.note
 * @param {DocumentFragment} frag
 * @param {Object} opts
 * @returns {Promise<DocumentFragment>}
 */
export async function post_process(source, frag, opts = {}) {
  const container = frag.querySelector('.source-inspector .source-inspector-blocks-container');
  if (!container) return frag;

  if (!source || !source.blocks || source.blocks.length === 0) {
    this.safe_inner_html(container, `<p>No blocks</p>`);
    return frag;
  }

  // Sort blocks
  const sortedBlocks = source.blocks.sort((a, b) => a.line_start - b.line_start);

  for (const block of sortedBlocks) {
    // Build the short info line
    const subKeyDisplay = block.sub_key.split('#').join(' > ');
    const blockInfo = `${subKeyDisplay} (${block.size} chars; lines: ${block.line_start}-${block.line_end})`;

    // Flag
    const should_embed = block.should_embed
      ? `<span style="color: green;">should embed</span>`
      : `<span style="color: orange;">embedding skipped</span>`;
    const embed_status = block.vec
      ? `<span style="color: green;">vectorized</span>`
      : `<span style="color: orange;">not vectorized</span>`;

    // Read and sanitize content
    let blockContent = '';
    try {
      const raw = await block.read();
      blockContent = raw
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>')
        .replace(/\t/g, '&nbsp;&nbsp;');
    } catch (err) {
      console.error('[source_inspector] Error reading block:', err);
      blockContent = `<em style="color:red;">Error reading block content</em>`;
    }

    // Append to container
    const blockFrag = this.create_doc_fragment(`
      <p>
        ${blockInfo}<br>
        ${should_embed} | ${embed_status}
      </p>
      <blockquote>${blockContent}</blockquote>
      <hr>
    `);
    container.appendChild(blockFrag);
  }

  return frag;
}
