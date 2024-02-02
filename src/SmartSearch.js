class SmartSearch {
  constructor(main) {
    this.main = main;
  }
  async search(search_text, filter = {}) {
    try {
      if (!this.main.view?.brain?.smart_blocks?.smart_embed && !this.main.view?.brain?.smart_notes?.smart_embed) {
        const btn = { text: "Open Smart View", callback: () => this.main.open_settings() };
        return this.main.show_notice("Smart View must be open and embedding model must be set in the settings to use smart search.", { button: btn, timeout: 0 });
      }
      // has embeddings, complete search
      const collection = this.main.view?.brain?.smart_blocks?.smart_embed ? this.main.view.brain.smart_blocks : this.main.view.brain.smart_notes;
      const embedding = await collection.smart_embed.embed(search_text);
      return collection.nearest(embedding.vec, filter);
    } catch (e) {
      this.main.show_notice("Error in embedding search. See console for details.", { timeout: 0 });
      console.error(e);
      return []; // resp is null, undefined, or missing data
    }
  }
}
exports.SmartSearch = SmartSearch;
