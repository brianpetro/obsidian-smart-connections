const test = require('ava');
const { render_dataview_codeblocks } = require('./render_dataview_codeblocks');
test.beforeEach(() => {
  global.window = {};
});

test('returns the same file content if dataview api is not found', async t => {
  const fileContent = 'This is some file content';
  const notePath = '/path/to/note.md';
  const result = await render_dataview_codeblocks(fileContent, notePath);
  t.is(result, fileContent);
});

test('returns the same file content if there are no dataview code blocks', async t => {
  global.window["DataviewAPI"] = {};
  const fileContent = 'This is some file content without any dataview code blocks';
  const notePath = '/path/to/note.md';
  const result = await render_dataview_codeblocks(fileContent, notePath);
  t.is(result, fileContent);
});

test('calls dataview api queryMarkdown if there is a dataview code block', async t => {
  global.window["DataviewAPI"] = {
    queryMarkdown: () => {
      t.pass();
      return { successful: true, value: '' };
    }
  };
  const fileContent = '```dataview\nTable\n```';
  const notePath = '/path/to/note.md';
  await render_dataview_codeblocks(fileContent, notePath);
});