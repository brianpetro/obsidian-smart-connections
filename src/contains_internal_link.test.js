const test = require('ava');
const { contains_internal_link } = require("./contains_internal_link");
// contains_internal_link
test('returns true if user input contains internal link', t => {
  const userInput = 'This is a [[link]]';
  t.true(contains_internal_link(userInput));
});

test('returns false if user input does not contain internal link', t => {
  const userInput = 'This is a normal text';
  t.false(contains_internal_link(userInput));
});

test('returns false if user input only contains opening bracket', t => {
  const userInput = '[[ This is an opening bracket';
  t.false(contains_internal_link(userInput));
});

test('returns false if user input only contains closing bracket', t => {
  const userInput = 'This is a closing bracket ]]';
  t.false(contains_internal_link(userInput));
});

test('returns false if user input does not contain both opening and closing brackets', t => {
  const userInput = 'This is a [link]';
  t.false(contains_internal_link(userInput));
});