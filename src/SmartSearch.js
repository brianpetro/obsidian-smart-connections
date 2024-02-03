class SmartSearch {
  constructor(plugin) {
    this.main = plugin;
    this.plugin = plugin;
  }
  async search(search_text, filter = {}) {
    try {
      if (!this.main.view?.brain?.smart_blocks?.smart_embed && !this.main.view?.brain?.smart_notes?.smart_embed) {
        const btn = { text: "Open Smart View", callback: () => this.main.open_settings() };
        this.main.show_notice("Smart View must be open and embedding model must be set in the settings to use smart search.", { button: btn, timeout: 0 });
        return [];
      }
      if(!this.plugin.is_smart_view_open()){
        const btn = { text: "Open Smart View", callback: () => this.main.open_settings() };
        this.main.show_notice("Smart View must be open to use smart search.", { button: btn, timeout: 0 });
        return [];
      }
      // has embeddings, complete search
      const collection = this.main.view?.brain?.smart_blocks?.smart_embed ? this.main.view.brain.smart_blocks : this.main.view.brain.smart_notes;
      const embedding = await collection.smart_embed.embed(search_text);
      if(!embedding?.vec){
        this.main.show_notice("Failed to embed search text.", { timeout: 0 });
        return [];
      }
      return collection.nearest(embedding.vec, filter)
        // sort by sim desc
        .sort((a, b) => {
          if (a.sim > b.sim) return -1;
          if (a.sim < b.sim) return 1;
          return 0;
        })
      ;
    } catch (e) {
      this.main.show_notice("Error in embedding search. See console for details.", { timeout: 0 });
      console.error(e);
      return []; // resp is null, undefined, or missing data
    }
  }
}
exports.SmartSearch = SmartSearch;
