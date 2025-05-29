/**
 * Insert (or create) the lines that define a Connections-score column.
 * @param {string}  base_str      – raw text of the *.base* file (may be empty)
 * @param {string}  selected_key  – path / identifier of the note to compare with
 *                                  Pass the literal `this.file.file` for self-comparison.
 * @param {string=} property_name – optional custom label for the column
 * @returns {string} updated *.base* text
 */
export function insert_connections_score_column(
  base_str = '',
  selected_key,
  property_name = ''
) {
  if (!selected_key) return base_str ?? '';

  /* ────────────── derived values ────────────── */
  const prop = property_name ||
    selected_key.split('/').pop().replace(/\.md$/i, '');

  // special literal → leave unquoted; otherwise quote the key
  const compare_to =
    selected_key === 'this.file.file' ? 'this.file.file' : `"${selected_key}"`;

  const formula_ln = `  ${prop}: cos_sim(file.file, ${compare_to})`;
  const display_ln = `  formula.${prop}: ${prop}`;
  const order_ln   = `      - formula.${prop}`;

  /* tokenize file ────────────── */
  const lines = (base_str ?? '').split(/\r?\n/);

  /* ================================================================= FORMULAS */
  let idx = lines.findIndex((l) => /^formulas:\s*$/i.test(l));
  if (idx === -1) {                            // section missing → create it
    lines.unshift('formulas:', formula_ln);
  } else if (!lines.some((l) => l.trimStart() === formula_ln.trimStart())) {
    idx = find_block_end(lines, idx, /^\s{2}\S/);
    lines.splice(idx + 1, 0, formula_ln);
  }

  /* ================================================================= DISPLAY */
  idx = lines.findIndex((l) => /^display:\s*$/i.test(l));
  if (idx === -1) {
    const formulas_end = lines.findIndex((l) => /^formulas:\s*$/i.test(l));
    const insert_at = find_block_end(lines, formulas_end, /^\s{2}\S/) + 1;
    lines.splice(insert_at, 0, 'display:', display_ln);
  } else if (!lines.some((l) => l.trimStart() === display_ln.trimStart())) {
    idx = find_block_end(lines, idx, /^\s{2}\S/);
    lines.splice(idx + 1, 0, display_ln);
  }

  /* ================================================================= VIEWS */
  idx = lines.findIndex((l) => /^views:\s*$/i.test(l));
  if (idx === -1) {
    // no views section → create a minimal one
    lines.push(
      'views:',
      '  - type: table',
      '    name: Table',
      '    order:',
      '      - file.name',
      order_ln
    );
  } else {
    /* find the first table-view and its `order:` block (if any) */
    let order_idx = -1;
    for (let i = idx + 1; i < lines.length; i++) {
      if (/^\s*-\s+type:\s+table/i.test(lines[i])) {
        order_idx = lines.findIndex(
          (l, j) => j > i && /^\s*order:\s*$/i.test(l)
        );
        if (order_idx === -1) {
          /* table view exists but lacks `order:` – insert it just after the name */
          const name_ln = lines.findIndex(
            (l, j) => j > i && /^\s*name:\s+/i.test(l)
          );
          const insert_at = name_ln !== -1 ? name_ln + 1 : i + 1;
          lines.splice(
            insert_at,
            0,
            '    order:',
            `      - file.name`,
            order_ln
          );
        }
        break;
      }
    }
    /* table had an order list – prepend new formula if it isn’t already present */
    if (
      order_idx !== -1 &&
      !lines.some((l) => l.trimStart() === order_ln.trimStart())
    ) {
      lines.splice(order_idx + 1, 0, order_ln);
    }
  }

  return lines.filter((l) => l.trim()).join('\n').trim();
}

/* ─────────────────────────────── helpers ──────────────────────────────── */

/**
 * Scan forward until the first line that *doesn’t* match `indent_rx`.
 * @param {string[]} arr
 * @param {number}   start     – index of the section header
 * @param {RegExp}   indent_rx – regexp describing a line that belongs to the block
 * @returns {number} index of the last line inside the block
 */
const find_block_end = (arr, start, indent_rx) => {
  let i = start + 1;
  while (i < arr.length && indent_rx.test(arr[i])) i++;
  return i - 1;
};

/**
 * Lightweight guard – a “*.base* file” in Smart Connections
 * is literally a file with the `.base` extension.
 * @param {import('obsidian').TFile} f
 * @returns {boolean}
 */
export const is_base_file = (f) => !!f && f.extension === 'base';
