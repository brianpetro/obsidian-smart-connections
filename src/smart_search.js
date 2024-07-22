export class SmartSearch {
  constructor(plugin) {
    this.main = plugin;
    this.plugin = plugin; // DEPRECATED in favor of this.main???
  }
  async search(search_text, filter = {}) {
    try {
      if (!this.plugin.env?.smart_blocks?.smart_embed && !this.plugin.env?.smart_notes?.smart_embed) {
        this.plugin.notices.show("embed model not loaded", "Embed model not loaded. Please wait for the model to load and try again.");
        return [];
      }
      // has embeddings, complete search
      const collection = this.plugin.env?.smart_blocks?.smart_embed ? this.plugin.env.smart_blocks : this.plugin.env.smart_notes;
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