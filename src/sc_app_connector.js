import http from 'http';
import url from 'url';

export class ScAppConnector {
  constructor(plugin, port = 37042) {
    this.sc_plugin = plugin;
    this.port = port;
    this.server = null;
    this.dataview_api = null;
    this.check_env_interval = null;
  }
  get env() {
    return this.sc_plugin.env;
  }

  static async create(plugin, port) {
    const connector = new ScAppConnector(plugin, port);
    plugin.env.sc_app_connector = connector;
    await connector.init();
    return connector;
  }

  async init() {
    await this.get_dataview_api();
    await this.create_server();
    console.log(`ScAppConnector initialized on port ${this.port}`);
    this.start_env_check();
  }

  create_server() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const parsed_url = url.parse(req.url, true);
        
        if (parsed_url.pathname === '/message') {
          if (req.method === 'POST') {
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
          } else if (req.method === 'GET') {
            // Handle GET requests for connection check
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'Obsidian HTTP server is running' }));
          } else {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
          }
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });

      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`Port ${this.port} is already in use. Attempting to retry once.`);
          if (window.sc_app_connector_server) {
            window.sc_app_connector_server.close();
          }
          this.retry_count = (this.retry_count || 0) + 1;
          if (this.retry_count <= 1) {
            this.create_server().then(resolve).catch(reject);
          } else {
            console.error(`Failed to create server after retry. Port ${this.port} is still in use.`);
            reject(new Error(`Unable to start server on port ${this.port} after retry.`));
          }
        } else {
          reject(error);
        }
      });

      this.server.listen(this.port, () => {
        console.log(`Server running at http://localhost:${this.port}/`);
        window.sc_app_connector_server = this.server;
        resolve();
      });
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
      return resp;
    } catch (err) {
      console.error(err);
      return { status: "error", message: err.message };
    }
  }

  async current_note() {
    const curr_file = this.sc_plugin.app.workspace.getActiveFile();
    if (!curr_file) return { path: null, content: null };
    let content = await this.env.fs.read(curr_file.path);
    return {
      path: curr_file.path,
      content: content,
    };
  }

  async current_notes() {
    const cfiles = [];
    await this.sc_plugin.app.workspace.iterateRootLeaves((leave) => {
      cfiles.push(leave.view.file.path);
    });
    return cfiles;
  }

  async full_render(markdown, rel_path) {
    const html_elm = document.createElement("div");
    const { MarkdownRenderer, htmlToMarkdown, Component } = this.sc_plugin.obsidian;
    await MarkdownRenderer.render(this.sc_plugin.app, markdown, html_elm, rel_path, new Component());
    
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
    if (window.sc_app_connector_server) {
      window.sc_app_connector_server.close(() => {
        console.log('Window server reference closed');
      });
      delete window.sc_app_connector_server;
    }
    if (this.check_env_interval) {
      clearInterval(this.check_env_interval);
    }
  }

  start_env_check() {
    this.check_env_interval = setInterval(() => {
      if (!this.env) {
        console.log('Environment no longer available. Closing server.');
        this.close_server();
      }
    }, 5000); // Check every 5 seconds
  }
}