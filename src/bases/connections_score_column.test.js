import test from 'ava';
import { insert_connections_score_column as mutate } from './connections_score_column.js';

const source   = '+Notes/Target.md';
const label = 'Target';
const OBSIDIAN_DEFAULT = `views:
  - type: table
    name: Table
`;
const expected_output = `
formulas:
  ${label}: cos_sim(file.file, "${source}")
display:
  formula.${label}: ${label}
views:
  - type: table
    name: Table
    order:
      - file.name
      - formula.${label}
`.trim();

test('handles default Obsidian table', t => {
  const out = mutate(OBSIDIAN_DEFAULT, source);
  t.is(out, expected_output);
});

test('creates all sections when file is empty', t => {
  const out = mutate('', source);
  t.is(out, expected_output);
});

const has_existing = `
formulas:
  Foo: bar
display:
  formula.Foo: Foo
views:
  - type: table
    name: Table
    order:
      - formula.Foo
`.trim();
const has_existing_expected = `
formulas:
  Foo: bar
  ${label}: cos_sim(file.file, "${source}")
display:
  formula.Foo: Foo
  formula.${label}: ${label}
views:
  - type: table
    name: Table
    order:
      - formula.${label}
      - formula.Foo
`.trim();

test('inserts new column into existing table before existing columns', t => {
  const out = mutate(has_existing, source);
  t.is(out, has_existing_expected);
});

const this_expected_output = expected_output
  .replace(
    `"${source}"`,
    'this.file.file'
  )
  .replace(RegExp(`${source
    .replace('.', '\\.')
    .replace('/', '\\/')
    .replace('+', '\\+')
  }`, 'g'), 'this.file.file')
  .replace(RegExp(`${label}`, 'g'), 'this.file.file');
;

test(`this.file.file is left unquoted`, t => {
  const out = mutate(OBSIDIAN_DEFAULT, 'this.file.file');
  t.is(out, this_expected_output);
});
