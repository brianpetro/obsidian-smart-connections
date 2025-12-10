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
        const connections_list = entity.connections;
        if(!connections_list?.env) {
          container.empty();
          container.createEl('p', { text: 'Smart Environment / Connections loading…' });
          // retry button
          const retry_button = container.createEl('button', { text: 'Retry' });
          retry_button.addEventListener('click', () => {
            render_codeblock();
          });
          return;
        }
        const connections_container = await plugin.env.smart_components.render_component(
          'connections_codeblock',
          connections_list,
          {
            ...cb_config, // FUTURE: handling codeblock config options
          }
        );
        container.empty();
        container.appendChild(connections_container);
      };
      if(!container._has_listeners) {
        container._has_listeners = true;
        const disposers = [];
        disposers.push(env.events.on('settings:changed', (event) => {
          console.log('connections codeblock view detected settings change', event);
          if(event.path?.includes('connections_lists')){
            render_codeblock();
          }
        }));
        smart_view.attach_disposer(container, disposers);
      }
      render_codeblock();
    }
  );
}