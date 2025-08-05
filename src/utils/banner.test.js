import test from 'ava';
import { create_banner } from './banner.js';

test('create_banner includes name, version, author and year', t => {
  const banner = create_banner({ name: 'pkg', version: '1.0.0', author: 'Author' });
  const year = new Date().getFullYear();
  t.is(banner, `/*! pkg v1.0.0 | (c) ${year} Author */`);
});
