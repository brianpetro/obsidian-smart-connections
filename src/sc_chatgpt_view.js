const { ItemView } = require("obsidian");
class SmartChatGPTView extends ItemView {
  static get view_type() { return 'smart_chatgpt'; }
  static get_leaf(workspace) { return workspace.getLeavesOfType(this.view_type)?.find((leaf) => leaf.view instanceof this); }
  static open(workspace, active = true) {
    if (this.get_leaf(workspace)) this.get_leaf(workspace).setViewState({ type: this.view_type, active });
    else workspace.getRightLeaf(false).setViewState({ type: this.view_type, active });
    if(workspace.rightSplit.collapsed) workspace.rightSplit.toggle();
  }
  getViewType() { return this.constructor.view_type; }
  getDisplayText() { return "Smart ChatGPT"; }
  getIcon() { return "bot"; }
  onload() {
    console.log("loading view");
    this.initialize();
  }
  initialize() {
    this.containerEl.empty();
    // insert button to refresh
    const refreshButton = this.containerEl.createEl("button", {
      text: "Refresh",
    });
    refreshButton.addEventListener("click", () => {
      this.initialize();
    });
    // insert ChatGPT
    this.containerEl.appendChild(this.create());
  }

  create() {
    this.frame = document.createElement("webview");
    this.frame.setAttribute("nodeintegration", "");
    this.frame.setAttribute("contextisolation", "");
    this.frame.setAttribute("allowpopups", "");
    this.frame.style.width = "100%";
    this.frame.style.height = "100%";
    this.frame.setAttribute("src", "https://chatgpt.com");
    return this.frame;
  }
}

exports.SmartChatGPTView = SmartChatGPTView;

