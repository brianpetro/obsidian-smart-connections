const fs = require('fs');
const path = require('path');
const templates_dir = path.join(process.cwd(), 'src', 'views'); // Directory containing EJS files
let views = {};
(async () => {
  
  
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
  
    console.log('views', views);
    fs.writeFileSync('build/views.json', JSON.stringify(views, null, 2));
    console.log('EJS templates compiled into templates.json');
  });
})();