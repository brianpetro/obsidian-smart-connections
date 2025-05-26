const test = require('ava');
const { canvas_to_chatml } = require('./canvas_to_chatml');
const { chat_canvas, chat_ml } = require('../test/_env');
test('should convert canvas to chat_ml', (t) => {
  // console.log(JSON.stringify(canvas_to_chatml(chat_canvas), null, 2));
  t.deepEqual(canvas_to_chatml(chat_canvas), chat_ml);
});

