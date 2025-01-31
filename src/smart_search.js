export class SmartSearch {
  constructor(plugin) {
    this.main = plugin;
    this.plugin = plugin; // DEPRECATED in favor of this.main???
  }
  async search(search_text, filter = {}) {
    try {
      if (!this.plugin.env?.smart_blocks?.smart_embed && !this.plugin.env?.smart_sources?.smart_embed) {
        this.main.notices.show("embed_model_not_loaded");
        return [];
      }
      // has embeddings, complete search
      const collection = this.plugin.env?.smart_blocks?.smart_embed ? this.plugin.env.smart_blocks : this.plugin.env.smart_sources;
      const embedding = await collection.smart_embed.embed(search_text);
      if(!embedding?.vec){
        this.main.notices.show("embed_search_text_failed");
        return [];
      }
      return (await collection.nearest(embedding.vec, filter))
        // sort by sim desc
        .sort((a, b) => {
          if (a.score > b.score) return -1;
          if (a.score < b.score) return 1;
          return 0;
        })
      ;
    } catch (e) {
      this.main.notices.show("error_in_embedding_search");
      console.error(e);
      return []; // resp is null, undefined, or missing data
    }
  }
}