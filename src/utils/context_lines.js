const BLOCK_SEPARATOR = '#';
const DISPLAY_SEPARATOR = ' › ';
const PATH_SEPARATOR = '/';

export function get_context_lines(item) {
  const key = item.key;
  let top_line = '';
  let bottom_line = '';
  let parts = [];
  if(key.includes(BLOCK_SEPARATOR)) {
    parts = key.split(BLOCK_SEPARATOR);
    bottom_line = parts.pop().trim();
    if(bottom_line[0] === '{') {
      const lines = item.lines.join('-');
      bottom_line = parts.pop().trim() + ` Lines: ${lines}`;
    }
    top_line = parts.filter(Boolean).join(BLOCK_SEPARATOR);
  } else if(key.includes(PATH_SEPARATOR)) {
    parts = key.split(PATH_SEPARATOR);
    bottom_line = parts.pop().trim();
  }
  top_line = parts.filter(Boolean).join(DISPLAY_SEPARATOR);
  return [top_line, bottom_line];
}
