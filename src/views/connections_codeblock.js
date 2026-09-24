/**
 * Register markdown processor for smart-connections codeblocks.
 * @param {object} plugin
 */
export async function register_smart_connections_codeblock(plugin) {
  plugin.registerMarkdownCodeBlockProcessor(
    'smart-connections',
    async (cb_content, container, mpp_ctx) => {
      container.empty();
      container.createEl('span', { text: 'Loading…' });
      const cb_config = JSON.parse(cb_content.trim() || '{}');
      const env = plugin.env;
      const entity =
        env.smart_sources.get(mpp_ctx.sourcePath) ??
        env.smart_sources.init_file_path(mpp_ctx.sourcePath)
      ;
      const smart_view = env.smart_view;

      if (!entity) {
        container.empty();
        container.createEl('p', { text: 'Entity not found: ' + mpp_ctx.sourcePath });
        return;
      }
      const render_codeblock = async () => {
        if(!env.connections_lists?.new_connections_list) {
          container.empty();
          container.createEl('p', { text: 'Loading connections environment...' });
          // retry button
          const retry_button = container.createEl('button', { text: 'Retry' });
          retry_button.addEventListener('click', () => {
            container._render_connections_codeblock?.();
          });
          return;
        }
        try {
          // Local settings must not share the sidebar's or another codeblock's
          // in-flight retrieval. A fresh, unregistered list also isolates rerenders.
          const connections_list = env.connections_lists.new_connections_list(entity);
          const connections_container = await plugin.env.smart_components.render_component(
            'connections_codeblock',
            connections_list,
            {
              connections_settings: cb_config,
            }
          );
          container.empty();
          container.appendChild(connections_container);
        } catch (err) {
          console.error(err);
          container.empty();
          container.createEl('p', {
            text: `Unable to load connections: ${err?.message || 'Unknown error'}`,
          });
        }
      };
      container._render_connections_codeblock = render_codeblock;
      if(!container._has_listeners) {
        container._has_listeners = true;
        const disposers = [];
        disposers.push(env.events.on('settings:changed', (event) => {
          if (event.path_string === 'connections_lists.components.connections_graph_v1.render_links') return;
          // console.log('connections codeblock view detected settings change', event);
          if(event.path?.includes('connections_lists')){
            container._render_connections_codeblock?.();
          }
        }));
        smart_view.attach_disposer(container, disposers);
      }
      render_codeblock();
    }
  );
}