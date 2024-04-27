const test = require('ava');
const {
  contains_internal_link,
  contains_folder_reference,
  get_nearest_until_next_dev_exceeds_std_dev,
  sort_by_len_adjusted_similarity,
  extract_folder_references,
  get_top_k_by_sim,
  top_acc,
} = require('./sc_actions');

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

// get_nearest_until_next_dev_exceeds_std_dev
test('returns the nearest items until the next deviation exceeds the standard deviation', t => {
  const nearest = [
    { sim: 0.1 },
    { sim: 0.2 },
    { sim: 0.3 },
    { sim: 0.4 },
    { sim: 0.5 },
    // { sim: 0.6 },
    // { sim: 0.7 },
    // { sim: 0.8 },
    { sim: 0.9 },
    { sim: 1.0 },
  ];
  const expected = [
    { sim: 0.1 },
    { sim: 0.2 },
    { sim: 0.3 },
    { sim: 0.4 },
    { sim: 0.5 },
  ];
  const result = get_nearest_until_next_dev_exceeds_std_dev(nearest);
  t.deepEqual(result, expected);
});

test('returns the nearest item if there is only one item', t => {
  const nearest = [
    { sim: 0.1 },
  ];
  const expected = [
    { sim: 0.1 },
  ];
  const result = get_nearest_until_next_dev_exceeds_std_dev(nearest);
  t.deepEqual(result, expected);
});

test('returns an empty array if there are no items', t => {
  const nearest = [];
  const expected = [];
  const result = get_nearest_until_next_dev_exceeds_std_dev(nearest);
  t.deepEqual(result, expected);
});

// sort_by_len_adjusted_similarity
test('sorts nearest items by len adjusted similarity in descending order', t => {
  const nearest = [
    { sim: 0.1, tokens: 5 },
    { sim: 0.2, tokens: 3 },
    { sim: 0.3, tokens: 7 },
    { sim: 0.4, tokens: 2 },
    { sim: 0.5, tokens: 4 },
  ];
  const expected = [
    { sim: 0.4, tokens: 2 }, // 0.2
    { sim: 0.5, tokens: 4 }, // 0.125
    { sim: 0.2, tokens: 3 }, // 0.06666666666666667
    { sim: 0.3, tokens: 7 }, // 0.04285714285714286
    { sim: 0.1, tokens: 5 }, // 0.02
  ];
  const result = sort_by_len_adjusted_similarity(nearest);
  t.deepEqual(result, expected);
});

test('returns the same array if there is only one item', t => {
  const nearest = [
    { sim: 0.1, tokens: 5 },
  ];
  const expected = [
    { sim: 0.1, tokens: 5 },
  ];
  const result = sort_by_len_adjusted_similarity(nearest);
  t.deepEqual(result, expected);
});

test('returns an empty array if there are no items to sort', t => {
  const nearest = [];
  const expected = [];
  const result = sort_by_len_adjusted_similarity(nearest);
  t.deepEqual(result, expected);
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


// get_top_k_by_sim
test('returns the top k items by similarity', t => {
  const results = [
    { data: { embedding: { vec: [1, 2, 3] } } },
    { data: { embedding: { vec: [4, 5, 6] } } },
    { data: { embedding: { vec: [7, 8, 9] } } },
    { data: { embedding: { vec: [10, 11, 12] } } },
  ];
  const opts = { vec: [1, 2, 3], k: 2 };
  const expected = [
    { data: { embedding: { vec: [1, 2, 3] } }, sim: 1 },
    { data: { embedding: { vec: [4, 5, 6] } }, sim: 0.9746318461970762 },
  ];
  const result = get_top_k_by_sim(results, opts);
  t.deepEqual(result, expected);
});

test('returns an empty set if no items have vectors', t => {
  const results = [
    { data: { embedding: {} } },
    { data: { embedding: {} } },
    { data: { embedding: {} } },
  ];
  const opts = { vec: [1, 2, 3], k: 2 };
  const expected = [];
  const result = get_top_k_by_sim(results, opts);
  t.deepEqual(result, expected);
});

test('returns an empty set if no items are provided', t => {
  const results = [];
  const opts = { vec: [1, 2, 3], k: 2 };
  const expected = [];
  const result = get_top_k_by_sim(results, opts);
  t.deepEqual(result, expected);
});

// top_acc
test('adds item to _acc.items if _acc.items size is less than ct', t => {
  const _acc = {
    items: new Set(),
    min: 0,
    minItem: null,
  };
  const item = { sim: 0.5 };
  const ct = 10;
  top_acc(_acc, item, ct);
  t.true(_acc.items.has(item));
});