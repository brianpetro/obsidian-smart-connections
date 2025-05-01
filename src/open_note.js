export async function open_note(plugin, target_path, event = null) {
  const env = plugin.env;

  if (target_path.includes('.pdf#page=')) {
    return plugin.app.workspace.openLinkText(target_path, '/');
  }

  if (target_path.endsWith('#')) target_path = target_path.slice(0, -1);

  let target_file;
  let block = null;

  if (target_path.includes('#')) {
    const [file_path] = target_path.split('#');
    target_file = plugin.app.metadataCache.getFirstLinkpathDest(file_path, '');
    block = env.smart_blocks.get(target_path);       // May be undefined.
  } else {
    target_file = plugin.app.metadataCache.getFirstLinkpathDest(target_path, '');
  }

  if (!target_file) {
    console.warn(`[open_note] Unable to resolve file for ${target_path}`);
    return;
  }
  let leaf;

  if (event) {
    const is_mod = plugin.obsidian.Keymap.isModEvent(event);
    const is_alt = plugin.obsidian.Keymap.isModifier(event, 'Alt');

    if (is_mod && is_alt) {
      // Split to the right of the active leaf.
      leaf = plugin.app.workspace.splitActiveLeaf('vertical');
    } else if (is_mod) {
      // Open in a *new* leaf (tab) but do not split.
      leaf = plugin.app.workspace.getLeaf(true);
    } else {
      // No modifiers → reuse current leaf.
      leaf = plugin.app.workspace.getMostRecentLeaf();
    }
  } else {
    // Fallback when no event supplied.
    leaf = plugin.app.workspace.getMostRecentLeaf();
  }

  // Open file & position cursor if a block was specified
  await leaf.openFile(target_file);

  if (typeof block?.line_start === 'number') {
    const { editor } = leaf.view;
    const pos = { line: block.line_start, ch: 0 };
    editor.setCursor(pos);
    editor.scrollIntoView({ to: pos, from: pos }, true);
  }
}
