import fs from 'fs';
import path from 'path';
import swaggerJsdoc from 'swagger-jsdoc';

const templates_dir = path.join(process.cwd(), 'src', 'views'); // Directory containing EJS files
let views = {};
(async () => {
  // // Compile EJS templates into JSON
  // fs.readdir(templates_dir, (err, files) => {
  //   if (err) {
  //     console.error('Error reading the directory', err);
  //     return;
  //   }
  //   files.forEach(file => {
  //     if(!['.ejs', '.md'].includes(path.extname(file))) return;
  //     const file_path = path.join(templates_dir, file);
  //     const content = fs.readFileSync(file_path, 'utf8').replace(/\r\n/g, '\n');
  //     views[path.basename(file, path.extname(file))] = content;
  //   });
  //   // console.log('views', views);
  //   fs.writeFileSync('build/views.json', JSON.stringify(views, null, 2));
  //   console.log('EJS templates compiled into templates.json');
  // });

  // Compile Tools into OpenAPI JSON
  const apis = [];
  // get action file paths from src/actions
  const action_names = fs.readdirSync(path.join(process.cwd(), 'src', 'actions')).filter(file => file.endsWith('.js'));
  // action_names.forEach(action_name => {
  for(const action_name of action_names) {
    if(action_name.startsWith('_')) continue;
    console.log(action_name);
    try {
      const action_path = path.join(process.cwd(), 'src', 'actions', action_name);
      const absolute_path = path.resolve(action_path);
      const action_url = new URL(`file://${absolute_path.replace(/\\/g, '/')}`).href;
      console.log('Importing action:', {action_name, absolute_path, action_url});
      
      const { [path.basename(action_name, '.js')]: action } = await import(action_url);
      
      if (typeof action !== 'function') {
        throw new Error(`${action_name} is not a function: ${typeof action}`);
      }
      
      apis.push(absolute_path);
    } catch (error) {
      console.error(`Error processing action ${action_name}:`, error);
    }
  }
  const openapi_spec = swaggerJsdoc({ definition: {openapi: '3.0.0'}, apis });
  fs.writeFileSync(path.join(process.cwd(), 'build', 'actions_openapi.json'), JSON.stringify(openapi_spec, null, 2));
})();