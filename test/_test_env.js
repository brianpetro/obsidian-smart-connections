const { ScEnv } = require('../src/sc_env');
const { default_settings } = require('../src/default_settings');
const path = require('path');
const fs = require('fs');
const test_md_path = path.join(__dirname, 'test_vault', 'test.md');
const test_md = fs.readFileSync(test_md_path, 'utf8'); // get test.md file
class MockTFile { constructor(data) { Object.assign(this, data); } }
exports.MockTFile = MockTFile;
class MockMarkdownRenderer { static render(app, markdown, container, rel_path, component) { container.innerHTML = `<pre>${markdown}</pre>`; } }
class MockNotice {
  constructor(message, duration) { this.message = message; this.duration = duration; }
  setMessage(message) { this.message = message; }
}
const mock_document = {
  createElement: () => { return { innerHTML: '', addEventListener: () => { }, appendChild: () => { } }; },
  createDocumentFragment: () => { return { innerHTML: '', appendChild: () => { } }; },
  querySelector: () => { return { innerHTML: '' }; },
};
// const test_file_paths = [
//   test_md_path,
// ];
// test file paths are retrieved recursively from the test_vault folder
function get_test_file_paths() {
  const test_vault_path = path.join(__dirname, 'test_vault');
  const test_file_paths = [];
  function get_files(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const file_path = path.join(dir, file);
      const stat = fs.statSync(file_path);
      if (stat.isDirectory()) {
        get_files(file_path);
      } else {
        test_file_paths.push(
          file_path
            .replace(__dirname, '') // remove __dirname from file_path
            .replace(/\\/g, '/') // replace backslashes with forward slashes (for windows compatibility)
            .slice(1) // remove leading forward slash
        );
      }
    }
  }
  get_files(test_vault_path);
  return test_file_paths;
}
const test_file_paths = get_test_file_paths();
console.log('test_file_paths', test_file_paths);

function get_tfile(file_path) {
  return new MockTFile({
    path: file_path.replace(/\\/g, '/'), // replace backslashes with forward slashes (for windows compatibility)
    extension: 'md',
    stat: {
      mtime: new Date(),
      size: Math.floor(Math.random() * 1000), // rand between 0 and 1000
    },
  });
}
async function init_test_env(t) {
  t.context.test_file_paths = test_file_paths;
  t.context.test_md_path = test_file_paths[0];
  t.context.test_md = test_md;
  const main = {
    app: {
      vault: {
        cachedRead: () => { },
        getAbstractFileByPath: () => { },
        getFiles: () => { return test_file_paths.map(file_path => get_tfile(file_path)); },
      },
    },
    obsidian: {
      TFile: MockTFile,
      Notice: MockNotice,
      document: mock_document,
    },
    // notices
    show_notice: (message, opts) => {
      t.show_notices ? t.show_notices.push({ message, opts }) : t.show_notices = [{ message, opts }];
    },
    _notice: {},
    _notice_content: {}, // for updating notice without creating new notice
    ...default_settings(),
  };
  main.settings.smart_blocks_embed_model = 'TaylorAI/bge-micro-v2';
  main.settings.smart_blocks.min_chars = 1;
  main.settings.multi_heading_blocks = false;
  main.get_tfile = get_tfile; // override main.get_tfile
  main.read_file = async (t_file) => test_md;
  const env = new ScBrain(main);
  env.save = () => { }; // override env.save
  env.init_import = async () => { await env.smart_notes.import.call(env.smart_notes, {reset: true}); };
  await env.init();
  const smart_notes = Object.values(env.smart_notes.items);
  const smart_blocks = smart_notes.flatMap(note => note.last_history.blocks).map(block_key => env.smart_blocks.get(block_key));
  return t.context = {
    ...t.context,
    env,
    ...smart_notes.reduce((obj, smart_note, i) => {
      obj['smart_note' + (i ? '_' + i : '')] = smart_note;
      return obj;
    }, {}),
    ...smart_blocks.reduce((obj, smart_block, i) => {
      obj['smart_block' + (i ? '_' + i : '')] = smart_block;
      return obj;
    }, {}),
  };
}
exports.init_test_env = init_test_env;

function log_parser(message, optionalParams, og_fx, write_to_file=false) {
  const stack = new Error().stack
    .split('\n')
    .slice(3)
    .filter((str) => !str.includes('print_log'))
    .map((line) => line
      .replace(' at ', '')
      .replace(' new ', '')
      .replace(' async ', '')
      .trim()
    )
  ;
  const fx_name = stack // Extract class and function names
    // starts with capital letter and includes ':' (indicating line number)
    .find(str => /^[A-Z]/.test(str) && str.includes(':'))?.split(' ')
    .filter((str) => !str.startsWith('('))
    .join(' ')
  ;
  const line_number = stack[0].match(/:(\d+|):?(\d+)\)?$/)?.slice(1).join(':'); // get line number
  // Prepend details (class and function)
  if(typeof message === 'object') {
    const preface = `[${fx_name}${typeof line_number !== 'undefined' ? " "+line_number : ""}]`;
    if(typeof message?.env !== 'undefined') message = { ...message, env: '...', config: '...'}
    og_fx(preface);
  }else{
    message = `[${fx_name}${typeof line_number !== 'undefined' ? " "+line_number : ""}] ${message}`;
  }
  // message += '\n' + stack.join('\n'); // add stack trace
  if((typeof optionalParams === 'object') && optionalParams){
    if(typeof optionalParams.env !== 'undefined') optionalParams = { ...optionalParams, env: '...', config: '...'}
  }
  if(write_to_file){
    // add timestamp (YYYY-MM-DD HH:mm:ss)
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    write_to_file.write(timestamp + ' ');
    (typeof message === 'object') ? write_to_file.write(JSON.stringify(message, null, 2) + '\n') : write_to_file.write(message + '\n');
    (optionalParams) ? write_to_file.write(optionalParams + '\n') : null;
    // write_to_file.write(stack.join('\n') + '\n');
  }
  return (optionalParams) ? og_fx(message, optionalParams) : og_fx(message);
  // og_fx(stack); // for debugging
}
const og_log = console.log;
const og_error = console.error;
console.log = (message, optionalParams) => log_parser(message, optionalParams, og_log);
console.error = (message, optionalParams) => log_parser(message, optionalParams, og_error);