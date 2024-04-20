const {
  SmartBlock: BaseSmartBlock,
  SmartBlocks,
  SmartNote: BaseSmartNote,
  SmartNotes,
} = require('smart-entities');
const { render_dataview_codeblocks } = require('./render_dataview_codeblocks');
class SmartNote extends BaseSmartNote {
  async get_content() { return await this.brain.cached_read(this.data.path); }
  async get_as_context(params = {}) {
    const content = await render_dataview_codeblocks(await this.get_content(), this.data.path);
    return `---BEGIN NOTE${params.i ? " " + params.i : ""} [[${this.path}]]---\n${content}\n---END NOTE${params.i ? " " + params.i : ""}---`;
  }
}
class SmartBlock extends BaseSmartBlock {
  async get_as_context(params = {}) {
    const content = await render_dataview_codeblocks(await this.get_content(), this.data.path);
    return `---BEGIN NOTE${params.i ? " " + params.i : ""} [[${this.path}]]---\n${content}\n---END NOTE${params.i ? " " + params.i : ""}---`;
  }
}
exports.SmartNotes = SmartNotes;
exports.SmartNote = SmartNote;
exports.SmartBlocks = SmartBlocks;
exports.SmartBlock = SmartBlock;

