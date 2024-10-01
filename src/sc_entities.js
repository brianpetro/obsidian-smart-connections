import {
  SmartBlock,
  SmartBlocks,
  SmartSource,
  SmartSources,
} from 'smart-sources';
import { render_dataview_codeblocks } from './render_dataview_codeblocks.js';

// NOTE: Not extending to prevent redundant classes in bundled version
// TODO: should find solution to this for easy extending (better code)

SmartSource.prototype.get_as_context = async function(params = {}) {
  const content = await render_dataview_codeblocks(await this.get_content(), this.path);
  return `---BEGIN NOTE${params.i ? " " + params.i : ""} [[${this.path}]]---\n${content}\n---END NOTE${params.i ? " " + params.i : ""}---`;
}

SmartBlock.prototype.get_as_context = async function(params = {}) {
  const content = await render_dataview_codeblocks(await this.get_content(), this.path);
  return `---BEGIN NOTE${params.i ? " " + params.i : ""} [[${this.path}]]---\n${content}\n---END NOTE${params.i ? " " + params.i : ""}---`;
}

export { SmartSources, SmartSource, SmartBlocks, SmartBlock };
