const { SmartSocket } = require("./smart_socket");

class DataviewSocket extends SmartSocket {
  constructor(env, port) {
    super(port);
    this.env = env;
    this.brain = this.env; // DEPRECATED
    this.dataview_api = null;
  }
  static async create(env, port) {
    const smart_socket = new DataviewSocket(env, port);
    env.dv_ws = smart_socket;
    await smart_socket.init();
    return smart_socket;
  }
  async init() {
    await this.get_dataview_api();
    await this.connect();
    // console.log("DataviewSocket initialized");
  }
  async is_server_running(){
    try{
      const sc_local = await this.env.main.obsidian?.requestUrl({url: 'http://localhost:37421/', method: 'GET'});
      console.log(sc_local);
      return sc_local?.status === 200;
    }catch(err){
      // console.error(err);
      return false;
    }
  }
  async get_dataview_api(retries = 0) {
    this.dataview_api = window["DataviewAPI"];
    if (!this.dataview_api) {
      if (retries < 10) {
        await new Promise(resolve => setTimeout(resolve, retries * 1000));
        return this.get_dataview_api(retries + 1);
      } else {
        this.brain.main.show_notice("Dataview API not found");
      }
    }
  }
  async handle_message(event) {
    console.log("Message from server ", event.data);
    console.log(typeof event.data);
    const data = JSON.parse(event.data);
    try {
      const resp = await this.dataview_api.queryMarkdown(data.query, data.rel_path, null);
      console.log(resp);
      this.ws.send(JSON.stringify(resp));
    } catch (err) {
      console.error(err);
      this.ws.send(JSON.stringify({ status: "error", message: err }));
    }
  }
}
exports.DataviewSocket = DataviewSocket;
