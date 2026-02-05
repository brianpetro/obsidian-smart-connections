import { ReleaseNotesView as BaseReleaseNotesView } from 'obsidian-smart-env/views/release_notes_view.js';
import release_notes_md from '../../releases/latest_release.md' with { type: 'markdown' };

export class ReleaseNotesView extends BaseReleaseNotesView {
  static view_type = 'smart-release-notes-view';
  static plugin_id = 'smart-connections';
  static release_notes_md = release_notes_md;
}
