
const test = require('ava');
const { chatml_to_canvas, } = require('./chatml_to_canvas');
const { chat_canvas, chat_ml } = require('../test/_env');
test('should convert chat_ml to canvas', (t) => {
  console.log(JSON.stringify(chatml_to_canvas(chat_ml), null, 2));
  t.deepEqual(chatml_to_canvas(chat_ml), chat_canvas);
});

