const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/index.js'],
  outfile: 'dist/main.js',
  bundle: true,
  external: ['obsidian', 'crypto'],
}).catch(() => process.exit(1));