import http from 'http';
import url from 'url';

export class ScAppConnector {
  constructor(env, port = 37421) {
    this.env = env;
    this.port = port;
    this.server = null;
    this.dataview_api = null;
  }

  static async create(env, port) {
    const connector = new ScAppConnector(env, port);
    env.sc_app_connector = connector;
    await connector.init();
    return connector;
  }

  async init() {
    await this.get_dataview_api();
    this.create_server();
    console.log(`ScAppConnector initialized on port ${this.port}`);
  }

  create_server() {
    this.server = http.createServer((req, res) => {
      const parsed_url = url.parse(req.url, true);
      
      if (parsed_url.pathname === '/message' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const response = await this.handle_message(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: error.message }));
          }
        });
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    this.server.listen(this.port, () => {
      console.log(`Server running at http://localhost:${this.port}/`);
    });
  }

  async get_dataview_api(retries = 0) {
    this.dataview_api = window["DataviewAPI"];
    if (!this.dataview_api) {
      if (retries < 10) {
        await new Promise(resolve => setTimeout(resolve, retries * 1000));
        return this.get_dataview_api(retries + 1);
      } else {
        console.log("Dataview API not found. No dataview connection for Smart Connect.");
      }
    }
  }

  async handle_message(data) {
    console.log("Message received:", data);

    if (data.fx === 'full_render') {
      const rendered = await this.full_render(data.markdown, data.rel_path);
      return { status: "ok", rendered: rendered };
    }

    if (data.fx === 'current_note') {
      return await this.current_note();
    }

    if (data.fx === 'current_notes') {
      return await this.current_notes();
    }

    try {
      const resp = await this.dataview_api.queryMarkdown(data.query, data.rel_path, null);
      console.log(resp);
      return resp;
    } catch (err) {
      console.error(err);
      return { status: "error", message: err.message };
    }
  }

  async current_note() {
    const curr_file = this.env.plugin.app.workspace.getActiveFile();
    if (!curr_file) return { path: null, content: null };
    let content = await this.env.main.read_file(curr_file);
    return {
      path: curr_file.path,
      content: content,
    };
  }

  async current_notes() {
    const cfiles = [];
    await this.env.plugin.app.workspace.iterateRootLeaves((leave) => {
      cfiles.push(leave.view.file.path);
    });
    return cfiles;
  }

  async full_render(markdown, rel_path) {
    const html_elm = document.createElement("div");
    const { MarkdownRenderer, htmlToMarkdown, Component } = this.env.plugin.obsidian;
    await MarkdownRenderer.render(this.env.plugin.app, markdown, html_elm, rel_path, new Component());
    
    let html = html_elm.innerHTML;
    await new Promise(resolve => setTimeout(resolve, 200));
    while (html !== html_elm.innerHTML) {
      html = html_elm.innerHTML;
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log("waiting for changes");
    }
    
    return htmlToMarkdown(html_elm.innerHTML);
  }

  close_server() {
    if (this.server) {
      this.server.close(() => {
        console.log('Server closed');
      });
    }
  }
}
