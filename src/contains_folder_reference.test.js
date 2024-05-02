const test = require('ava');
const { contains_folder_reference } = require('./contains_folder_reference');

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