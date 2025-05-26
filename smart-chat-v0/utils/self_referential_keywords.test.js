import test from 'ava';
import { contains_self_referential_keywords } from './self_referential_keywords.js';

const mock_env = {
  plugin: {
    get_folders: () => {
      return [
        '/my notes/as context/',
      ];
    }
  }
};

test('returns true for input containing self-referential pronouns in English', async t => {
    const user_input = 'I want to review my notes';
    t.true(await contains_self_referential_keywords(user_input, 'en'));
});

test('returns true for input containing self-referential pronouns in Spanish', async t => {
    const user_input = 'Quiero revisar mis notas';
    t.true(await contains_self_referential_keywords(user_input, 'es'));
});

test('returns false for input without self-referential pronouns', async t => {
    const user_input = 'The sky is blue';
    t.false(await contains_self_referential_keywords(user_input, 'en'));
});

test('returns true for input with uppercase self-referential pronouns', async t => {
    const user_input = 'MY notes are important to ME';
    t.true(await contains_self_referential_keywords(user_input, 'en'));
});

test('returns true for input with mixed case self-referential pronouns', async t => {
    const user_input = 'Show Me My latest notes';
    t.true(await contains_self_referential_keywords(user_input, 'en'));
});

test('returns false for input with partial matches of pronouns ("myself" contains "my")', async t => {
    const user_input = 'The word "myself" is not always self-referential';
    t.false(await contains_self_referential_keywords(user_input, 'en'));
});

test('returns true for input with pronouns at the beginning or end of sentences', async t => {
    const user_input = 'My thoughts are clear. These ideas belong to me.';
    t.true(await contains_self_referential_keywords(user_input, 'en'));
});

test('returns false for empty input', async t => {
    const user_input = '';
    t.false(await contains_self_referential_keywords(user_input, 'en'));
});

test('handles unsupported language gracefully', async t => {
    const user_input = 'This is a test';
    t.false(await contains_self_referential_keywords(user_input, 'unsupported_language'));
});

test('returns true for input containing multiple self-referential pronouns', async t => {
    const user_input = 'I need to organize my notes so I can find them easily';
    t.true(await contains_self_referential_keywords(user_input, 'en'));
});

test('excludes self-referential pronouns that are within links', async t => {
    const user_input = 'Should use [[my notes]] as context without lookup';
    t.false(await contains_self_referential_keywords(user_input, 'en'));
});

test('excludes self-referential pronouns that are within /folder/paths/', async t => {
    const user_input = 'Should not match /my notes/as context/ as self-referential';
    t.false(await contains_self_referential_keywords(user_input, 'en'));
});

test('excludes self-referential pronouns that are within @"system prompt" refs', async t => {
    const user_input = 'Should use @"my system prompt" in this query';
    t.false(await contains_self_referential_keywords(user_input, 'en'));
});