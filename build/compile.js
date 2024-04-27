const fs = require('fs');
const path = require('path');
const templates_dir = path.join(process.cwd(), 'src', 'views'); // Directory containing EJS files
let views = {};
const swagger_jsdoc = require('swagger-jsdoc');
(async () => {
  // Compile EJS templates into JSON
  fs.readdir(templates_dir, (err, files) => {
    if (err) {
      console.error('Error reading the directory', err);
      return;
    }
    files.forEach(file => {
      if(path.extname(file) !== '.ejs') return;
      const file_path = path.join(templates_dir, file);
      const content = fs.readFileSync(file_path, 'utf8');
      views[path.basename(file, path.extname(file))] = content;
    });
    // console.log('views', views);
    fs.writeFileSync('build/views.json', JSON.stringify(views, null, 2));
    console.log('EJS templates compiled into templates.json');
  });

  // Compile Tools into OpenAPI JSON
  const apis = [];
  // get action file paths from src/actions
  const action_names = fs.readdirSync(path.join(process.cwd(), 'src', 'actions')).filter(file => file.endsWith('.js'));
  action_names.forEach(action_name => {
      if(action_name.startsWith('_')) return;
      console.log(action_name);
      const action_path = path.join(process.cwd(), 'src', 'actions', action_name);
      const { [path.basename(action_name, '.js')]: action } = require(action_path);
      if(typeof action !== 'function') return console.log(`${action_path} is not a function: ${typeof action}`);
      apis.push(action_path);
  });
  const openapi_spec = swagger_jsdoc({ definition: {openapi: '3.0.0'}, apis });
  fs.writeFileSync(path.join(process.cwd(), 'build', 'actions_openapi.json'), JSON.stringify(openapi_spec, null, 2));
})();