// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // set the render_code_block method
  modifyMe.prototype.render_code_block = async function(contents, container, ctx) {
    let nearest;
    if(contents.trim().length > 0) {
      nearest = await this.api.search(contents);
    } else {
      // use ctx to get file
      console.log(ctx);
      const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
      nearest = await this.find_note_connections(file);
    }
    if (nearest.length) {
      this.update_results(container, nearest);
      // const list = container.createEl("ul");
      // list.addClass("smart-connections-list");
      // for (const item of nearest) {
      //   const el = list.createEl("li", {
      //     cls: "smart-connections-item",
      //     text: item.link
      //   });
      // }

    }
  }

  // inject function returns nothing, it just modifies the class

}