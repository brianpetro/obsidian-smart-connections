const { SMART_CONNECTIONS_VIEW_TYPE, SMART_CONNECTIONS_CHAT_VIEW_TYPE } = require( "./json/constants.json" );

// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // set the onload method
  modifyMe.prototype.onload = async function() {
    this.addIcon();
    await this.loadSettings();
    console.log("loading plugin");
    this.addCommand({
      id: "sc-find-notes",
      name: "Find: Make Smart Connections",
      icon: "pencil_icon",
      hotkeys: [],
      // editorCallback: async (editor) => {
      editorCallback: async (editor) => {
        if(editor.somethingSelected()) {
          // get selected text
          let selected_text = editor.getSelection();
          // render connections from selected text
          await this.make_connections(selected_text);
        } else {
          // clear nearest_cache on manual call to make connections
          this.nearest_cache = {};
          // console.log("Cleared nearest_cache");
          await this.make_connections();
        }
      }
    });
    this.addCommand({
      id: "smart-connections-view",
      name: "Open: View Smart Connections",
      callback: () => {
        this.open_view();
      }
    });
    // open chat command
    this.addCommand({
      id: "smart-connections-chat",
      name: "Open: Smart Chat Conversation",
      callback: () => {
        this.open_chat();
      }
    });
    // get all files in vault
    this.addSettingTab(new SmartConnectionsSettingsTab(this.app, this));

    // register main view type
    this.registerView(SMART_CONNECTIONS_VIEW_TYPE, (leaf) => (new SmartConnectionsView(leaf, this)));
    // register chat view type
    this.registerView(SMART_CONNECTIONS_CHAT_VIEW_TYPE, (leaf) => (new SmartConnectionsChatView(leaf, this)));

    // initialize when layout is ready
    this.app.workspace.onLayoutReady(this.initialize.bind(this));

    /**
     * EXPERIMENTAL
     * - window-based API access
     * - code-block rendering
     */
    this.api = new ScSearchApi(this.app, this);
    // register API to global window object
    (window["SmartSearchApi"] = this.api) && this.register(() => delete window["SmartSearchApi"]);

    // code-block renderer
    this.registerMarkdownCodeBlockProcessor("smart-connections", this.render_code_block.bind(this));

  }

  // inject function returns nothing, it just modifies the class

}