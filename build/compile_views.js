const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const templates_dir = './src/views'; // Directory containing EJS files
let views = {};
(async () => {
  // const smart_embed_transformers_web_adapter = await esbuild.build({
  //   entryPoints: ['smart-embed/smart_embed_web.js'],
  //   format: 'cjs',
  //   // format: 'esm',
  //   bundle: true,
  //   write: false,
  //   sourcemap: 'inline',
  //   target: "es2018",
  //   logLevel: "info",
  //   treeShaking: true,
  //   platform: 'browser',
  //   external: [
  //     'obsidian',
  //     'crypto',
  //     '@xenova/transformers',
  //   ],
  // });
  // const smart_local_model = smart_embed_transformers_web_adapter.outputFiles[0].text;
  // // console.log(smart_local_model);
  
  
  fs.readdir(templates_dir, (err, files) => {
    if (err) {
      console.error('Error reading the directory', err);
      return;
    }
    // // add smart_local_model to views
    // views['smart_local_model'] = smart_local_model;
  
  
    files.forEach(file => {
      if(path.extname(file) !== '.ejs') return;
      const file_path = path.join(templates_dir, file);
      const content = fs.readFileSync(file_path, 'utf8');
      views[path.basename(file, path.extname(file))] = content;
    });
  
    fs.writeFileSync('build/views.json', JSON.stringify(views, null, 2));
    console.log('EJS templates compiled into templates.json');
  });
})();