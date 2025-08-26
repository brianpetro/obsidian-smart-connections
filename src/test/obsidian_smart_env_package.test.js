import test from 'ava';
import fs from 'fs';
import path from 'path';

const PACKAGE_PATH = '/Users/caio.niehues/CodeProjects/obsidian-smart-env';

test('obsidian-smart-env package.json exists and is valid', t => {
  const packageJsonPath = path.join(PACKAGE_PATH, 'package.json');
  t.true(fs.existsSync(packageJsonPath), 'package.json exists');
  
  if (fs.existsSync(packageJsonPath)) {
    const packageContent = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    t.is(packageContent.name, 'obsidian-smart-env', 'package name is correct');
    t.is(packageContent.type, 'module', 'package type is ES module');
    t.truthy(packageContent.version, 'version is defined');
    t.is(packageContent.main, 'index.js', 'main entry point is index.js');
  }
});

test('obsidian-smart-env index.js exists and exports required modules', async t => {
  const indexPath = path.join(PACKAGE_PATH, 'index.js');
  t.true(fs.existsSync(indexPath), 'index.js exists');
  
  if (fs.existsSync(indexPath)) {
    try {
      const module = await import(indexPath);
      t.truthy(module, 'module exports something');
    } catch (error) {
      t.fail(`Failed to import index.js: ${error.message}`);
    }
  }
});

test('build_smart_env_config.js exists and exports function', async t => {
  const buildConfigPath = path.join(PACKAGE_PATH, 'build_smart_env_config.js');
  t.true(fs.existsSync(buildConfigPath), 'build_smart_env_config.js exists');
  
  if (fs.existsSync(buildConfigPath)) {
    try {
      const module = await import(buildConfigPath);
      t.is(typeof module.build_smart_env_config, 'function', 'exports build_smart_env_config function');
      
      // Test that the function accepts the expected parameters
      const testConfig = module.build_smart_env_config('.', []);
      t.truthy(testConfig, 'function returns a config object');
    } catch (error) {
      t.fail(`Failed to import or execute build_smart_env_config: ${error.message}`);
    }
  }
});