// set module export to be a function to support dependency injection
module.exports = function injectMethod( Obsidian, modifyMe ){

  // inject this method: 
  modifyMe.prototype.render_brand = function(container) {
    // brand container
    const brand_container = container.createEl("div", { cls: "sc-brand" });
    // add text
    // add SVG signal icon using getIcon
    Obsidian.setIcon(brand_container, "smart-connections");
    const brand_p = brand_container.createEl("p");
    brand_p.createEl("a", {
      cls: "",
      text: "Smart Connections",
      href: "https://wfhbrian.com/introducing-smart-chat-transform-your-obsidian-notes-into-interactive-ai-powered-conversations/?utm_source=plugin",
      target: "_blank"
    });
  }
    
  // inject function returns nothing, it just modifies the class

}