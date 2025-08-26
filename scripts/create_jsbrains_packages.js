#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const JSBRAINS_PATH = '/Users/caio.niehues/CodeProjects/jsbrains';

const packages = [
  { name: 'smart-blocks', className: 'SmartBlocks' },
  { name: 'smart-chat-model', className: 'SmartChatModel' },
  { name: 'smart-chunks', className: 'SmartChunks' },
  { name: 'smart-collections', className: 'SmartCollections' },
  { name: 'smart-embed-model', className: 'SmartEmbedModel' },
  { name: 'smart-entities', className: 'SmartEntities' },
  { name: 'smart-fs', className: 'SmartFileSystem' }, // maps to smart-file-system
  { name: 'smart-http-request', className: 'SmartHttpRequest' },
  { name: 'smart-instruct-model', className: 'SmartInstructModel' },
  { name: 'smart-model', className: 'SmartModel' },
  { name: 'smart-notices', className: 'SmartNotices' },
  { name: 'smart-settings', className: 'SmartSettings' },
  { name: 'smart-sources', className: 'SmartSources' },
  { name: 'smart-utils', className: 'SmartUtils' },
  { name: 'smart-view', className: 'SmartView' }
];

function createPackageJson(packageName, className) {
  return {
    name: packageName,
    version: "1.0.0",
    type: "module",
    description: `${className} module for JSBrains ecosystem`,
    main: "index.js",
    scripts: {
      test: "echo \"No tests configured\""
    },
    keywords: ["jsbrains", packageName],
    author: "Brian Petro",
    license: "MIT"
  };
}

function createIndexJs(className) {
  return `// ${className} stub implementation
export class ${className} {
  constructor(opts = {}) {
    this.opts = opts;
  }
  
  init() {
    console.log('${className} initialized');
  }
}

export default ${className};

// Additional named exports that might be needed
export const version = '1.0.0';
`;
}

// Create packages
packages.forEach(({ name, className }) => {
  const packagePath = path.join(JSBRAINS_PATH, name);
  
  // Create package directory if it doesn't exist
  if (!fs.existsSync(packagePath)) {
    fs.mkdirSync(packagePath, { recursive: true });
  }
  
  // Create package.json
  const packageJsonPath = path.join(packagePath, 'package.json');
  const packageJsonContent = createPackageJson(name, className);
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJsonContent, null, 2));
  console.log(`Created ${packageJsonPath}`);
  
  // Create index.js
  const indexJsPath = path.join(packagePath, 'index.js');
  const indexJsContent = createIndexJs(className);
  fs.writeFileSync(indexJsPath, indexJsContent);
  console.log(`Created ${indexJsPath}`);
});

console.log('\n✅ All jsbrains packages created successfully!');