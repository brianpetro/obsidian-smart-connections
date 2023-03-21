// set module export to be a function to support dependency injection
module.exports = function injectMethod( Obsidian, modifyMe ){

  // inject this method: 
  modifyMe.prototype.update_results = async function(container, nearest) {
    let list;
    // check if list exists
    if((container.children.length > 1) && (container.children[1].classList.contains("sc-list"))){
      list = container.children[1];
    }
    // if list exists, empty it
    if (list) {
      list.empty();
    } else {
      // create list element
      list = container.createEl("div", { cls: "sc-list" });
    }
    let search_result_class = "search-result";
    // if settings expanded_view is false, add sc-collapsed class
    if(!this.settings.expanded_view) search_result_class += " sc-collapsed";

    // TODO: add option to group nearest by file
    if(!this.settings.group_nearest_by_file) {
      // for each nearest note
      for (let i = 0; i < nearest.length; i++) {
        /**
         * BEGIN EXTERNAL LINK LOGIC
         * if link is an object, it indicates external link
         */
        if (typeof nearest[i].link === "object") {
          const item = list.createEl("div", { cls: "search-result" });
          const link = item.createEl("a", {
            cls: "search-result-file-title is-clickable",
            href: nearest[i].link.path,
            title: nearest[i].link.title,
          });
          link.innerHTML = this.render_external_link_elm(nearest[i].link);
          item.setAttr('draggable', 'true')
          continue; // ends here for external links
        }
        /**
         * BEGIN INTERNAL LINK LOGIC
         * if link is a string, it indicates internal link
         */
        let file_link_text;
        const file_similarity_pct = Math.round(nearest[i].similarity * 100) + "%";
        if(this.settings.show_full_path) {
          const pcs = nearest[i].link.split("/");
          file_link_text = pcs[pcs.length - 1];
          const path = pcs.slice(0, pcs.length - 1).join("/");
          // file_link_text = `<small>${path} | ${file_similarity_pct}</small><br>${file_link_text}`;
          file_link_text = `<small>${file_similarity_pct} | ${path} | ${file_link_text}</small>`;
        }else{
          file_link_text = '<small>' + file_similarity_pct + " | " + nearest[i].link.split("/").pop() + '</small>';
        }
        // skip contents rendering if incompatible file type
        // ex. not markdown file or contains no '.excalidraw'
        if(!this.renderable_file_type(nearest[i].link)){
          const item = list.createEl("div", { cls: "search-result" });
          const link = item.createEl("a", {
            cls: "search-result-file-title is-clickable",
            href: nearest[i].link,
          });
          link.innerHTML = file_link_text;
          // drag and drop
          item.setAttr('draggable', 'true')
          // add listeners to link
          this.add_link_listeners(link, nearest[i], item);
          continue;
        }

        // remove file extension if .md and make # into >
        file_link_text = file_link_text.replace(".md", "").replace(/#/g, " > ");
        // create item
        const item = list.createEl("div", { cls: search_result_class });
        // create span for toggle
        const toggle = item.createEl("span", { cls: "is-clickable" });
        // insert right triangle svg as toggle
        Obsidian.setIcon(toggle, "right-triangle"); // must come before adding other elms to prevent overwrite
        const link = toggle.createEl("a", {
          cls: "search-result-file-title",
          title: nearest[i].link,
        });
        link.innerHTML = file_link_text;
        // add listeners to link
        this.add_link_listeners(link, nearest[i], item);
        toggle.addEventListener("click", (event) => {
          // find parent containing search-result class
          let parent = event.target.parentElement;
          while (!parent.classList.contains("search-result")) {
            parent = parent.parentElement;
          }
          // toggle sc-collapsed class
          parent.classList.toggle("sc-collapsed");
        });
        const contents = item.createEl("ul", { cls: "" });
        const contents_container = contents.createEl("li", {
          cls: "search-result-file-title is-clickable",
          title: nearest[i].link,
        });
        if(nearest[i].link.indexOf("#") > -1){ // is block
          Obsidian.MarkdownRenderer.renderMarkdown((await this.block_retriever(nearest[i].link, {lines: 10, max_chars: 1000})), contents_container, nearest[i].link, void 0);
        }else{ // is file
          const first_ten_lines = await this.file_retriever(nearest[i].link, {lines: 10, max_chars: 1000});
          if(!first_ten_lines) continue; // skip if file is empty
          Obsidian.MarkdownRenderer.renderMarkdown(first_ten_lines, contents_container, nearest[i].link, void 0);
        }
        this.add_link_listeners(contents, nearest[i], item);
      }
      this.render_brand(container);
      return;
    }

    // group nearest by file
    const nearest_by_file = {};
    for (let i = 0; i < nearest.length; i++) {
      const curr = nearest[i];
      const link = curr.link;
      // skip if link is an object (indicates external logic)
      if (typeof link === "object") {
        nearest_by_file[link.path] = [curr];
        continue;
      }
      if (link.indexOf("#") > -1) {
        const file_path = link.split("#")[0];
        if (!nearest_by_file[file_path]) {
          nearest_by_file[file_path] = [];
        }
        nearest_by_file[file_path].push(nearest[i]);
      } else {
        if (!nearest_by_file[link]) {
          nearest_by_file[link] = [];
        }
        // always add to front of array
        nearest_by_file[link].unshift(nearest[i]);
      }
    }
    // for each file
    const keys = Object.keys(nearest_by_file);
    for (let i = 0; i < keys.length; i++) {
      const file = nearest_by_file[keys[i]];
      /**
       * Begin external link handling
       */
      // if link is an object (indicates v2 logic)
      if (typeof file[0].link === "object") {
        const curr = file[0];
        const meta = curr.link;
        if (meta.path.startsWith("http")) {
          const item = list.createEl("div", { cls: "search-result" });
          const link = item.createEl("a", {
            cls: "search-result-file-title is-clickable",
            href: meta.path,
            title: meta.title,
          });
          link.innerHTML = this.render_external_link_elm(meta);
          item.setAttr('draggable', 'true');
          continue; // ends here for external links
        }
      }
      /**
       * Handles Internal
       */
      let file_link_text;
      const file_similarity_pct = Math.round(file[0].similarity * 100) + "%";
      if (this.settings.show_full_path) {
        const pcs = file[0].link.split("/");
        file_link_text = pcs[pcs.length - 1];
        const path = pcs.slice(0, pcs.length - 1).join("/");
        file_link_text = `<small>${path} | ${file_similarity_pct}</small><br>${file_link_text}`;
      } else {
        file_link_text = file[0].link.split("/").pop();
        // add similarity percentage
        file_link_text += ' | ' + file_similarity_pct;
      }


        
      // skip contents rendering if incompatible file type
      // ex. not markdown or contains '.excalidraw'
      if(!this.renderable_file_type(file[0].link)) {
        const item = list.createEl("div", { cls: "search-result" });
        const file_link = item.createEl("a", {
          cls: "search-result-file-title is-clickable",
          title: file[0].link,
        });
        file_link.innerHTML = file_link_text;
        // add link listeners to file link
        this.add_link_listeners(file_link, file[0], item);
        continue;
      }


      // remove file extension if .md
      file_link_text = file_link_text.replace(".md", "").replace(/#/g, " > ");
      const item = list.createEl("div", { cls: search_result_class });
      const toggle = item.createEl("span", { cls: "is-clickable" });
      // insert right triangle svg icon as toggle button in span
      Obsidian.setIcon(toggle, "right-triangle"); // must come before adding other elms else overwrites
      const file_link = toggle.createEl("a", {
        cls: "search-result-file-title",
        title: file[0].link,
      });
      file_link.innerHTML = file_link_text;
      // add link listeners to file link
      this.add_link_listeners(file_link, file[0], toggle);
      toggle.addEventListener("click", (event) => {
        // find parent containing class search-result
        let parent = event.target;
        while (!parent.classList.contains("search-result")) {
          parent = parent.parentElement;
        }
        parent.classList.toggle("sc-collapsed");
        // TODO: if block container is empty, render markdown from block retriever
      });
      const file_link_list = item.createEl("ul");
      // for each link in file
      for (let j = 0; j < file.length; j++) {
        // if is a block (has # in link)
        if(file[j].link.indexOf("#") > -1) {
          const block = file[j];
          const block_link = file_link_list.createEl("li", {
            cls: "search-result-file-title is-clickable",
            title: block.link,
          });
          // skip block context if file.length === 1 because already added
          if(file.length > 1) {
            const block_context = this.render_block_context(block);
            const block_similarity_pct = Math.round(block.similarity * 100) + "%";
            block_link.innerHTML = `<small>${block_context} | ${block_similarity_pct}</small>`;
          }
          const block_container = block_link.createEl("div");
          // TODO: move to rendering on expanding section (toggle collapsed)
          Obsidian.MarkdownRenderer.renderMarkdown((await this.block_retriever(block.link, {lines: 10, max_chars: 1000})), block_container, block.link, void 0);
          // add link listeners to block link
          this.add_link_listeners(block_link, block, file_link_list);
        }else{
          // get first ten lines of file
          const file_link_list = item.createEl("ul");
          const block_link = file_link_list.createEl("li", {
            cls: "search-result-file-title is-clickable",
            title: file[0].link,
          });
          const block_container = block_link.createEl("div");
          let first_ten_lines = await this.file_retriever(file[0].link, {lines: 10, max_chars: 1000});
          if(!first_ten_lines) continue; // if file not found, skip
          Obsidian.MarkdownRenderer.renderMarkdown(first_ten_lines, block_container, file[0].link, void 0);
          this.add_link_listeners(block_link, file[0], file_link_list);

        }
      }
    }
    this.render_brand(container);
  }
    
  // inject function returns nothing, it just modifies the class

}