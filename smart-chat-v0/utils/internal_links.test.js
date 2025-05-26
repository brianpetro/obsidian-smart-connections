import test from 'ava';
import {
  contains_internal_link,
  extract_internal_links,
  extract_internal_links2,
  contains_internal_embedded_link,
  extract_internal_embedded_links
} from './internal_links.js';
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

test('extracts internal links', t => {
  const userInput = 'This is a [[link]] and [[another link]]';
  const links = extract_internal_links(userInput);
  t.deepEqual(links, ['link', 'another link']);
});
test('extracts internal links 2', t => {
  const userInput = 'This is a [[link]] and [[another link]]';
  const links = extract_internal_links2(userInput);
  t.deepEqual(links, ['link', 'another link']);
});

test.serial('benchmark extract_internal_links performance', t => {
  const user_input = 'This is a [[link]] and [[another link]] and [[third link]] with some text in between [[fourth link]] and even [[fifth link]] to make it more realistic';
  const start_time = process.hrtime();
  
  const iterations = 100000;
  for (let i = 0; i < iterations; i++) {
    extract_internal_links(user_input);
  }
  
  const [seconds, nanoseconds] = process.hrtime(start_time);
  const total_time = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds
  
  console.log(`extract_internal_links took ${total_time.toFixed(2)}ms for ${iterations} iterations`);
  t.pass();
});

test.serial('benchmark extract_internal_links2 performance', t => {
  const user_input = 'This is a [[link]] and [[another link]] and [[third link]] with some text in between [[fourth link]] and even [[fifth link]] to make it more realistic';
  const start_time = process.hrtime();
  
  const iterations = 100000;
  for (let i = 0; i < iterations; i++) {
    extract_internal_links2(user_input);
  }
  
  const [seconds, nanoseconds] = process.hrtime(start_time);
  const total_time = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds
  
  console.log(`extract_internal_links2 took ${total_time.toFixed(2)}ms for ${iterations} iterations`);
  t.pass();
});

// contains_internal_embedded_link
test('returns true if user input contains internal embedded link', t => {
  const userInput = 'This is a ![[link]]';
  t.true(contains_internal_embedded_link(userInput));
});
test('returns false if user input does not contain internal embedded link', t => {
  const userInput = 'This is a [[link]]';
  t.false(contains_internal_embedded_link(userInput));
});
test('extracts internal embedded links', t => {
  const userInput = 'This is a ![[link]] and ![[another link]]';
  const links = extract_internal_embedded_links(userInput);
  t.deepEqual(links[0][1], 'link');
  t.deepEqual(links[1][1], 'another link');
});
test('does not extract links from non-embedded links', t => {
  const userInput = 'This is a [[link]] and ![[another link]]';
  const links = extract_internal_embedded_links(userInput);
  t.deepEqual(links[0][1], 'another link');
});

// FUTURE: should handle display text (e.g. ![[link|display text]])