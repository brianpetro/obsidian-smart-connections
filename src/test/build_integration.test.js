import test from 'ava';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const PROJECT_ROOT = '/Users/caio.niehues/CodeProjects/obsidian-smart-claude';
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');

test('dist directory is created after build', async t => {
  // The build should create a dist directory
  t.true(fs.existsSync(DIST_DIR), 'dist directory exists');
});

test('main.js is generated in dist', async t => {
  const mainPath = path.join(DIST_DIR, 'main.js');
  if (fs.existsSync(DIST_DIR)) {
    t.true(fs.existsSync(mainPath), 'dist/main.js exists');
    if (fs.existsSync(mainPath)) {
      const stats = fs.statSync(mainPath);
      t.true(stats.size > 0, 'main.js is not empty');
    }
  } else {
    t.fail('dist directory does not exist');
  }
});

test('manifest.json is copied to dist', async t => {
  const manifestPath = path.join(DIST_DIR, 'manifest.json');
  if (fs.existsSync(DIST_DIR)) {
    t.true(fs.existsSync(manifestPath), 'dist/manifest.json exists');
    if (fs.existsSync(manifestPath)) {
      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      t.truthy(manifestContent.id, 'manifest has id field');
      t.truthy(manifestContent.name, 'manifest has name field');
      t.truthy(manifestContent.version, 'manifest has version field');
    }
  } else {
    t.fail('dist directory does not exist');
  }
});

test('styles.css is copied to dist', async t => {
  const stylesPath = path.join(DIST_DIR, 'styles.css');
  if (fs.existsSync(DIST_DIR)) {
    t.true(fs.existsSync(stylesPath), 'dist/styles.css exists');
  } else {
    t.fail('dist directory does not exist');
  }
});

test('build output does not contain obvious errors', async t => {
  const mainPath = path.join(DIST_DIR, 'main.js');
  if (fs.existsSync(mainPath)) {
    const content = fs.readFileSync(mainPath, 'utf8');
    t.false(content.includes('ERROR'), 'main.js does not contain ERROR');
    t.false(content.includes('Cannot find module'), 'main.js does not contain module errors');
    t.true(content.includes('Smart Connections') || content.includes('SmartConnections'), 'main.js contains expected plugin code');
  } else {
    t.fail('dist/main.js does not exist');
  }
});