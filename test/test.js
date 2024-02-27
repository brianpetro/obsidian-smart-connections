const test = require('ava');
const path = require('path');
const { init_test_brain } = require('./_test_env');
const { SmartBlock } = require('../src/smart_entities');
function clear_collections(t) {
  const { brain } = t.context;
  brain.smart_notes.clear();
  brain.smart_blocks.clear();
}
test.beforeEach(async (t) => {
  await init_test_brain(t);
});
// IMPORT NOTE
// test('SmartNotes.import(file_path)-> creates a SmartNote', (t) => {
//   const { smart_note, test_md_path } = t.context;
//   t.is(smart_note.data.path, test_md_path);
// });
// test('SmartNotes.import(file_path)-> creates SmartBlocks', (t) => {
//   const { brain } = t.context;
//   t.is(brain.smart_blocks.keys.length > 0, true);
// });
// test('SmartNotes.import(file_path)-> persists smart_block keys to smart_note.last_history.blocks', (t) => {
//   const { smart_note } = t.context;
//   t.is(smart_note.last_history.blocks.length > 0, true);
// });
// test('SmartNotes.import(file_path)-> smart_note.last_history.blocks[0] is the same as smart_blocks.keys[0]', (t) => {
//   const { smart_note, brain } = t.context;
//   t.is(smart_note.last_history.blocks[0], brain.smart_blocks.keys[0]);
// });
// test('SmartNotes.import(file_path)-> persists mtime to smart_note.last_history.mtime', (t) => {
//   const { smart_note } = t.context;
//   t.is(typeof smart_note.last_history.mtime, 'object');
// });
// test('SmartNotes.import(file_path)-> persists size to smart_note.last_history.size', (t) => {
//   const { smart_note } = t.context;
//   t.is(typeof smart_note.last_history.size, 'number');
// });
// test('SmartNotes.import(file_path)-> creates blocks with vec embeddings', (t) => {
//   const { brain } = t.context;
//   t.is(brain.smart_blocks.get(brain.smart_blocks.keys[0]).data.embedding.vec.length, 384);
// });
// test("SmartNotes.import(file_path)-> calls brain.save()", async (t) => {
//   clear_collections(t);
//   const { brain, test_md_path } = t.context;
//   brain.smart_notes.clear();
//   brain.save = () => { t.pass(); };
//   await brain.smart_notes.import(test_md_path);
// });
// test('SmartNotes.import(excluded_file_path)-> does not create a SmartNote', async (t) => {
//   const { brain, test_md_path } = t.context;
//   brain.smart_notes.clear();
//   brain.smart_blocks.clear();
//   t.is(brain.smart_notes.keys.length, 0);
//   const file_name = path.basename(test_md_path);
//   brain.main.settings.file_exclusions = file_name;
//   brain._file_exclusions = null; // clear file exclusions cache
//   await brain.smart_notes.import();
//   t.is(brain.smart_notes.keys.length, 0);
// });
// test('SmartNotes.import(excluded_folder_path)-> does not create a SmartNote', async (t) => {
//   const { brain, test_md_path } = t.context;
//   brain.smart_notes.clear();
//   brain.smart_blocks.clear();
//   t.is(brain.smart_notes.keys.length, 0);
//   const folder_name = path.basename(path.dirname(test_md_path));
//   brain.main.settings.folder_exclusions = folder_name;
//   brain._file_exclusions = null; // clear file exclusions cache (used as canonical matcher for both file and folder exclusions)
//   brain._folder_exclusions = null; // clear folder exclusions cache
//   await brain.smart_notes.import();
//   t.is(brain.smart_notes.keys.length, 0);
// });
// IMPORT BLOCKS
test('SmartNotes.import()-> calls brain.smart_notes._save()', async (t) => {
  const { brain, test_md_path } = t.context;
  brain.smart_blocks.clear();
  brain.smart_notes.clear();
  brain.smart_notes._save = () => { t.pass(); };
  await brain.smart_notes.import(test_md_path);
});
test('SmartBlocks.import(note)-> stores block content in smart_block.data.text', async (t) => {
  const { brain } = t.context;
  Object.values(brain.smart_blocks.items).forEach(smart_block => t.is(typeof smart_block.data.text, 'string'));
});
test('SmartBlocks.import(note_with_excluded_heading)-> does not create a SmartBlock', async (t) => {
  const { brain } = t.context;
  const original_blocks_count = brain.smart_blocks.keys.length;
  t.is(original_blocks_count, 11);
  brain.smart_blocks.clear();
  brain.smart_notes.clear();
  t.is(brain.smart_blocks.keys.length, 0);
  brain._excluded_headings = null; // clear excluded headings cache
  brain.main.settings.excluded_headings = 'test';
  await brain.smart_notes.import();
  t.is(brain.smart_blocks.keys.length, 0);
});
test('smart_block.content-> returns block content', async (t) => {
  const { smart_block, test_md } = t.context;
  t.is(typeof smart_block.content, 'string');
  t.is(smart_block.content.length > 0, true);
  t.is(test_md.includes(smart_block.content), true);
});
test('smart_block.import-> removes block if no longer exists in note', async (t) => {
  const { brain, test_md_path } = t.context;
  const original_blocks_count = brain.smart_blocks.keys.length;
  const smart_note = brain.smart_notes.get(test_md_path);
  smart_note.last_history.blocks = smart_note.last_history.blocks.slice(1);
  await brain.smart_blocks.import(smart_note);
  t.is(brain.smart_blocks.keys.length, original_blocks_count - 1);
});
test('smart_block.update_data-> removes embedding if block content length changes', async (t) => {
  const { smart_block } = t.context;
  smart_block.is_new = false; // set to false to test update_data
  smart_block.update_data({ text: 'new', length: 3 });
  t.deepEqual(smart_block.data.embedding, {});
});
// NEAREST
test('smart_blocks.nearest()-> respects include_path_begins_with filter', async (t) => {
  const { brain, smart_block, test_md_path } = t.context;
  const filter = { include_path_begins_with: path.dirname(test_md_path) };
  // console.log('filter', filter);
  const nearest = await brain.smart_blocks.nearest(smart_block.vec, filter);
  t.is(nearest.length > 0, true);
  t.is(nearest[0].data.path.startsWith(path.dirname(test_md_path)), true);
  const filter2 = { include_path_begins_with: "does_not_exist" };
  const nearest2 = await brain.smart_blocks.nearest(smart_block.vec, filter2);
  t.is(nearest2.length, 0);
});
// FIND CONNECTIONS
test('smart_note.find_connections()-> returns array of smart_blocks', (t) => {
  const { smart_note } = t.context;
  smart_note.data.key = 'different_key'; // change smart_note key to prevent excluding all blocks because they start with same key
  const results = smart_note.find_connections();
  t.is(Array.isArray(results), true);
  t.is(results.length > 0, true);
  t.is(results[0] instanceof SmartBlock, true);
});
// GET_CONTENT
test('smart_note.get_content()-> returns note content', async (t) => {
  const { smart_note, test_md } = t.context;
  const content = await smart_note.get_content();
  t.is(content, test_md);
});
// TEMPLATES
test('views.json contains EJS views', (t) => {
  const views_json = require('../build/views.json');
  // const views_json = require(path.join(process.cwd(), 'build', 'views.json'));
  t.is(typeof views_json, 'object');
  t.true(Object.keys(views_json).length > 0);
});
// GETTERS
test('smart_note.key is the same as smart_note.data.path', (t) => {
  const { smart_note, test_md_path } = t.context;
  t.is(smart_note.key, test_md_path);
});
test('smart_block.key-> is the same as smart_block.data.path', async (t) => {
  const { brain } = t.context;
  const smart_block = brain.smart_blocks.get(brain.smart_blocks.keys[0]);
  t.is(smart_block.key, smart_block.data.path);
});
test('smart_note.mean_block_vec-> avg of block vecs', (t) => {
  const { smart_note } = t.context;
  t.is(smart_note.mean_block_vec.length, 384);
});
test('smart_note.median_block_vec-> median of block vecs', (t) => {
  const { smart_note } = t.context;
  t.is(smart_note.median_block_vec.length, 384);
});
test('brain.files returns array of TFile objects', (t) => {
  const { MockTFile } = require('./_test_env');
  const { brain } = t.context;
  const files = brain.files;
  t.is(Array.isArray(files), true);
  t.is(files[0] instanceof MockTFile, true);
});
test('brain.files respects file_exclusions', (t) => {
  const { brain, test_md_path } = t.context;
  const original_files_count = brain.files.length;
  t.is(original_files_count > 0, true);
  brain.main.settings.file_exclusions = path.basename(test_md_path);
  brain._file_exclusions = null; // clear file exclusions cache
  t.is(brain.files.length, original_files_count - 1);
});
test('brain.files respects folder_exclusions', (t) => {
  const { brain } = t.context;
  const original_files_count = brain.files.length;
  t.is(original_files_count > 0, true);
  const folder_name = path.basename(path.dirname(brain.files[0].path));
  brain.main.settings.folder_exclusions = folder_name;
  brain._file_exclusions = null; // clear file exclusions cache (used as canonical matcher for both file and folder exclusions)
  brain._folder_exclusions = null; // clear folder exclusions cache
  t.is(brain.files.length, 0);
});


  // this.test_get_nearest_until_next_dev_exceeds_std_dev();
  // // test get_nearest_until_next_dev_exceeds_std_dev
  // test_get_nearest_until_next_dev_exceeds_std_dev() {
  //   const nearest = [{similarity: 0.99}, {similarity: 0.98}, {similarity: 0.97}, {similarity: 0.96}, {similarity: 0.95}, {similarity: 0.94}, {similarity: 0.93}, {similarity: 0.92}, {similarity: 0.91}, {similarity: 0.9}, {similarity: 0.79}, {similarity: 0.78}, {similarity: 0.77}, {similarity: 0.76}, {similarity: 0.75}, {similarity: 0.74}, {similarity: 0.73}, {similarity: 0.72}];
  //   const result = this.get_nearest_until_next_dev_exceeds_std_dev(nearest);
  //   if(result.length !== 10){
  //     console.error("get_nearest_until_next_dev_exceeds_std_dev failed", result);
  //   }
  // }