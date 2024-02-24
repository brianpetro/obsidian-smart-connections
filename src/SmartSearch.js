class SmartSearch {
  constructor(plugin) {
    this.main = plugin;
    this.plugin = plugin; // DEPRECATED in favor of this.main???
  }
  async search(search_text, filter = {}) {
    try {
      if (!this.main.view?.brain?.smart_blocks?.smart_embed && !this.main.view?.brain?.smart_notes?.smart_embed) {
        this.main.notices.show_requires_smart_view();
        return [];
      }
      if(!this.plugin.is_smart_view_open()){
        this.main.notices.show_requires_smart_view();
        return [];
      }
      // has embeddings, complete search
      const collection = this.main.view?.brain?.smart_blocks?.smart_embed ? this.main.view.brain.smart_blocks : this.main.view.brain.smart_notes;
      const embedding = await collection.smart_embed.embed(search_text);
      if(!embedding?.vec){
        this.main.notices.show("embed search text failed", "Failed to embed search text.")
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
      this.main.notices.show('error in embedding search', "Error in embedding search. See console for details.", { timeout: 0 });
      console.error(e);
      return []; // resp is null, undefined, or missing data
    }
  }
}
exports.SmartSearch = SmartSearch;
