import test from 'ava';
import fs from 'fs';
import path from 'path';

const JSBRAINS_PATH = '/Users/caio.niehues/CodeProjects/jsbrains';

const packages = [
  'smart-blocks',
  'smart-chat-model',
  'smart-chunks',
  'smart-collections',
  'smart-embed-model',
  'smart-entities',
  'smart-fs',
  'smart-http-request',
  'smart-instruct-model',
  'smart-model',
  'smart-notices',
  'smart-settings',
  'smart-sources',
  'smart-utils',
  'smart-view'
];

packages.forEach(pkg => {
  test(`${pkg} package structure is valid`, t => {
    const packagePath = path.join(JSBRAINS_PATH, pkg);
    const packageJsonPath = path.join(packagePath, 'package.json');
    const indexJsPath = path.join(packagePath, 'index.js');
    
    // Check directory exists
    t.true(fs.existsSync(packagePath), `${pkg} directory exists`);
    
    // Check package.json exists and is valid
    t.true(fs.existsSync(packageJsonPath), `${pkg}/package.json exists`);
    if (fs.existsSync(packageJsonPath)) {
      const packageContent = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      t.is(packageContent.name, pkg, `${pkg} package name is correct`);
      t.is(packageContent.type, 'module', `${pkg} is ES module`);
      t.is(packageContent.main, 'index.js', `${pkg} main entry is index.js`);
    }
    
    // Check index.js exists
    t.true(fs.existsSync(indexJsPath), `${pkg}/index.js exists`);
  });
  
  test(`${pkg} can be imported`, async t => {
    const indexJsPath = path.join(JSBRAINS_PATH, pkg, 'index.js');
    
    if (fs.existsSync(indexJsPath)) {
      try {
        const module = await import(indexJsPath);
        t.truthy(module, `${pkg} module exports something`);
        t.truthy(module.default || module[Object.keys(module)[0]], `${pkg} has default or named export`);
      } catch (error) {
        t.fail(`Failed to import ${pkg}: ${error.message}`);
      }
    }
  });
});