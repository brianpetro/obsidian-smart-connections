import { FuzzySuggestModal, Keymap } from 'obsidian';
export class ConnectionsModal extends FuzzySuggestModal {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
    this.results = [];
    this.modalEl.addEventListener('keydown', (e) => {
      if(e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this.selectActiveSuggestion(e);
      }
    });
  }

  getItems() {
    return this.results;
  }

  async onOpen() {
    const active = this.app.workspace.getActiveFile();
    if (!active) return;

    const env = this.plugin.env;
    let entity = env.smart_sources.get(active.path);

    // Initialise entity if needed.
    if (!entity) {
      env.smart_sources.fs.include_file(active.path);
      entity = env.smart_sources.init_file_path(active.path);
      if (!entity) return;
      await entity.import();
      await env.smart_sources.process_embed_queue();
    }

    // Embed if necessary.
    if (!entity.vec && entity.should_embed) {
      entity.queue_embed();
      await entity.collection.process_embed_queue();
    }

    this.results = await entity.find_connections();
    this.setInstructions([
      { command: 'Enter', purpose: 'Open and close modal' },
      { command: '⌘/Ctrl + Enter', purpose: 'Open in new tab and keep open' },
      { command: '⌘/Ctrl + Alt + Enter', purpose: 'Open in split (right) and keep open' },
      { command: 'Esc', purpose: 'Close' }
    ]);
    this.updateSuggestions();
  }

  getItemText(connection) {
    const name = connection.item.name ?? connection.item.key;
    const score = connection.score?.toFixed(2) ?? '?';
    return `${score} | ${name}`;
  }

  onChooseItem(connection, evt) {
    const target_path = connection.item.path;
    this.plugin.open_note(target_path, evt);
    if (Keymap.isModifier(evt, 'Mod')) {
      this.open();
    }
  }
}