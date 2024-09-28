export async function render(scope) {
  const cohere_api_key_html = `
    <div class="setting-component"
      data-name="Cohere API Key"
      data-type="text"
      data-setting="smart_view_filter.cohere_api_key"
      data-description="API Key required to use Cohere re-ranker."
      data-placeholder="Enter an API Key"
      data-button="Save"
    ></div>
  `;
  const early_access_html = !scope.EARLY_ACCESS ? '' : `
    <div class="setting-component"
      data-name="Toggle Re-Ranker"
      data-setting="smart_view_filter.re_rank"
      data-description="Toggle the re-ranker"
      data-type="toggle"
      data-default="false"
      data-value="false"
      data-callback="refresh_smart_view_filter"
    ></div>
    ${scope.settings.smart_view_filter?.re_rank ? cohere_api_key_html : ''}
  `;
  const html = `
    <!-- toggle re-ranker -->
    ${early_access_html}
    <div class="setting-component"
      data-name="Show Full Path"
      data-description="Show full path in view."
      data-type="toggle"
      data-setting="show_full_path"
      data-callback="refresh_smart_view"
    ></div>
    <!-- toggle exclude_inlinks -->
    <div class="setting-component"
      data-name="Exclude Inlinks"
      data-setting="smart_view_filter.exclude_inlinks"
      data-description="Exclude inlinks"
      data-type="toggle"
      data-default="false"
      data-callback="refresh_smart_view_filter"
    ></div>
    <!-- toggle exclude_outlinks -->
    <div class="setting-component"
      data-name="Exclude Outlinks"
      data-setting="smart_view_filter.exclude_outlinks"
      data-description="Exclude outlinks"
      data-type="toggle"
      data-default="false"
      data-callback="refresh_smart_view_filter"
    ></div>
    <!-- include filter -->
    <div class="setting-component"
      data-name="Include Filter"
      data-setting="smart_view_filter.include_filter"
      data-description="Require that results match this value."
      data-type="text"
      data-callback="refresh_smart_view"
    ></div>
    <!-- exclude filter -->
    <div class="setting-component"
      data-name="Exclude Filter"
      data-setting="smart_view_filter.exclude_filter"
      data-description="Exclude results that match this value."
      data-type="text"
      data-callback="refresh_smart_view"
    ></div>
  `;
  const frag = this.create_doc_fragment(html);
  return post_process.call(this, scope, frag);
}

export async function post_process(scope, frag) {
  await this.render_setting_components(frag, { scope });
  return frag;
}