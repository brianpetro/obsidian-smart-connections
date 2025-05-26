import test from 'ava';
import { contains_folder_reference, extract_folder_references } from './folder_references.js';

// contains_folder_reference
test('returns true if user input contains folder reference', t => {
  const userInput = 'This is a /folder/reference/';
  t.true(contains_folder_reference(userInput));
});
test('returns false if user input does not contain folder reference', t => {
  const userInput = 'This is a normal text';
  t.false(contains_folder_reference(userInput));
});
test('returns false if user input only contains one slash', t => {
  const userInput = 'This is a /';
  t.false(contains_folder_reference(userInput));
});
test('returns false if wrapped in parentheses', t => {
  const userInput = 'This is a (/folder/reference/)';
  t.false(contains_folder_reference(userInput));
});
test('returns false if is JavaScript comment', t => {
  const userInput = 'This is a //comment';
  t.false(contains_folder_reference(userInput));
});
test('returns true if folder contains parentheses', t => {
  const userInput = 'This is a /folder (reference)/';
  t.true(contains_folder_reference(userInput));
});
// should return false if contained in a link like [[folder/subfolder/this.md]]
test('returns false if contained in a link like [[folder/subfolder/this.md]]', t => {
  const folders = ['/folder/subfolder/'];
  const user_input = 'This is a [[folder/subfolder/this.md]] link';
  t.false(contains_folder_reference(user_input), 'should return false if contained in a link like [[folder/subfolder/this.md]]');
});

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

test('returns empty array if folder is in a link like [[folder/subfolder/this.md]]', t => {
  const folders = ['/folder/subfolder/'];
  const user_input = 'This is a [[folder/subfolder/this.md]] link';
  const expected = [];
  const result = extract_folder_references(folders, user_input);
  t.deepEqual(result, expected);
});
