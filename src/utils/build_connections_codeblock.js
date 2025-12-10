/**
 * Build a smart-connections codeblock string.
 *
 * @param {Object} [settings={}] - Connections filter settings.
 * @returns {string} codeblock string
 */
export function build_connections_codeblock(settings = null) {
  const json = settings ? JSON.stringify(settings, null, 2) : '';
  return `\u0060\u0060\u0060smart-connections\n${json}\n\u0060\u0060\u0060\n`;
}
