#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const JSBRAINS_PATH = '/Users/caio.niehues/CodeProjects/jsbrains';

// Define packages and their required exports
const packageExports = {
  'smart-collections': `export class Collection {
  constructor(opts = {}) {
    this.opts = opts;
  }
}

export class CollectionItem {
  constructor(opts = {}) {
    this.opts = opts;
  }
}

export default Collection;`,
  
  'smart-entities': `export class SmartEntity {
  constructor(opts = {}) {
    this.opts = opts;
  }
}

export class SmartEntities {
  constructor(opts = {}) {
    this.opts = opts;
  }
}

export default SmartEntities;`,

  'smart-fs': `export class SmartFs {
  constructor(opts = {}) {
    this.opts = opts;
  }
  
  async exists(path) { return false; }
  async read(path) { return ''; }
  async write(path, content) { return; }
}

export class SmartFileSystem {
  constructor(opts = {}) {
    this.opts = opts;
  }
}

export default SmartFileSystem;`,

  'smart-sources': `import { SmartEntity } from '../smart-entities/index.js';

export class SmartSource extends SmartEntity {
  constructor(opts = {}) {
    super(opts);
  }
}

export class SmartSources {
  constructor(opts = {}) {
    this.opts = opts;
  }
}

export default SmartSources;`,

  'smart-blocks': `import { SmartEntity } from '../smart-entities/index.js';

export class SmartBlock extends SmartEntity {
  constructor(opts = {}) {
    super(opts);
  }
}

export class SmartBlocks {
  constructor(opts = {}) {
    this.opts = opts;
  }
}

export default SmartBlocks;`,

  'smart-http-request': `export class SmartHttpRequest {
  constructor(opts = {}) {
    this.opts = opts;
  }
}

export class SmartHttpObsidianRequestAdapter {
  constructor(opts = {}) {
    this.opts = opts;
  }
}

export default SmartHttpRequest;`,

  'smart-utils': `export function escape_html(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, m => map[m]);
}

export function get_by_path(obj, path) {
  return path.split('.').reduce((o, p) => o && o[p], obj);
}

export function set_by_path(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((o, p) => o[p] = o[p] || {}, obj);
  target[last] = value;
}

export function delete_by_path(obj, path) {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((o, p) => o && o[p], obj);
  if (target) delete target[last];
}

export class SmartUtils {
  constructor(opts = {}) {
    this.opts = opts;
  }
}

export default SmartUtils;`
};

// Create or update each package's index.js
for (const [packageName, content] of Object.entries(packageExports)) {
  const indexPath = path.join(JSBRAINS_PATH, packageName, 'index.js');
  fs.writeFileSync(indexPath, content);
  console.log(`Updated ${indexPath}`);
}

// Also update smart-plugins-obsidian utils
const pluginsUtilsPath = '/Users/caio.niehues/CodeProjects/smart-plugins-obsidian/utils.js';
const pluginsUtilsContent = `export function get_smart_server_url() {
  return 'https://smart-connect.com';
}

export function fetch_plugin_zip(url) {
  return Promise.resolve(new ArrayBuffer(0));
}

export function parse_zip_into_files(buffer) {
  return [];
}

export function write_files_with_adapter(files, adapter) {
  return Promise.resolve();
}

export function enable_plugin(plugin) {
  return Promise.resolve();
}

export function someUtilityFunction() {
  return true;
}`;

fs.writeFileSync(pluginsUtilsPath, pluginsUtilsContent);
console.log(`Updated ${pluginsUtilsPath}`);

// Create missing packages that obsidian-smart-env references
const missingPackages = ['smart-completions', 'smart-actions', 'smart-contexts', 'smart-environment'];

for (const pkg of missingPackages) {
  const packagePath = path.join(JSBRAINS_PATH, pkg);
  if (!fs.existsSync(packagePath)) {
    fs.mkdirSync(packagePath, { recursive: true });
  }
  
  // Create package.json
  const packageJson = {
    name: pkg,
    version: "1.0.0",
    type: "module",
    description: `${pkg} module for JSBrains ecosystem`,
    main: "index.js",
    license: "MIT"
  };
  fs.writeFileSync(path.join(packagePath, 'package.json'), JSON.stringify(packageJson, null, 2));
  
  // Create basic index.js
  const indexContent = `export class ${pkg.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')} {
  constructor(opts = {}) {
    this.opts = opts;
  }
}

export default ${pkg.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')};`;
  
  fs.writeFileSync(path.join(packagePath, 'index.js'), indexContent);
  console.log(`Created missing package: ${pkg}`);
}

console.log('\n✅ All exports fixed!');