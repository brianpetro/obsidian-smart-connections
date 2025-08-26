import test from 'ava';
import fs from 'fs';
import path from 'path';

const BASE_PATH = '/Users/caio.niehues/CodeProjects';

const requiredDirectories = [
  'jsbrains',
  'obsidian-smart-env',
  'smart-chat-obsidian',
  'smart-context-obsidian'
];

test('all required directories exist', t => {
  const missingDirs = [];
  
  for (const dir of requiredDirectories) {
    const fullPath = path.join(BASE_PATH, dir);
    if (!fs.existsSync(fullPath)) {
      missingDirs.push(dir);
    }
  }
  
  t.is(missingDirs.length, 0, `Missing directories: ${missingDirs.join(', ')}`);
});

test('directories are accessible', t => {
  for (const dir of requiredDirectories) {
    const fullPath = path.join(BASE_PATH, dir);
    if (fs.existsSync(fullPath)) {
      try {
        fs.accessSync(fullPath, fs.constants.R_OK | fs.constants.W_OK);
        t.pass(`${dir} is readable and writable`);
      } catch (error) {
        t.fail(`${dir} is not accessible: ${error.message}`);
      }
    }
  }
});

test('jsbrains directory contains all sub-packages', t => {
  const jsbrainsPackages = [
    'smart-blocks',
    'smart-chat-model',
    'smart-chunks',
    'smart-collections',
    'smart-embed-model',
    'smart-entities',
    'smart-fs', // maps to smart-file-system
    'smart-http-request',
    'smart-instruct-model',
    'smart-model',
    'smart-notices',
    'smart-settings',
    'smart-sources',
    'smart-utils',
    'smart-view'
  ];
  
  const jsbrainsPath = path.join(BASE_PATH, 'jsbrains');
  if (fs.existsSync(jsbrainsPath)) {
    const missingPackages = [];
    
    for (const pkg of jsbrainsPackages) {
      const pkgPath = path.join(jsbrainsPath, pkg);
      if (!fs.existsSync(pkgPath)) {
        missingPackages.push(pkg);
      }
    }
    
    t.is(missingPackages.length, 0, `Missing jsbrains packages: ${missingPackages.join(', ')}`);
  } else {
    t.fail('jsbrains directory does not exist');
  }
});