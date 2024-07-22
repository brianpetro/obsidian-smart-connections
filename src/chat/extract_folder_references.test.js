import test from 'ava';
import { extract_folder_references } from './extract_folder_references.js';

// extract_folder_references
test('returns an array of folder references found in the user input', t => {
  const folders = ['/folder/subfolder/', '/folder/'];
  const user_input = 'This is a /folder/subfolder/ and /folder/ reference';
  const expected = ['/folder/subfolder/', '/folder/'];
  const result = extract_folder_references(folders, user_input);
  t.deepEqual(result, expected);
});

test('returns an empty array if no folder references are found in the user input', t => {
  const folders = ['/folder/subfolder/', '/folder/'];
  const user_input = 'This is a normal text';
  const expected = [];
  const result = extract_folder_references(folders, user_input);
  t.deepEqual(result, expected);
});
