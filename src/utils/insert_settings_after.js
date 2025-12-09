export function insert_settings_after(anchor_key, config, merge_object) {
  const config_entries = Object.entries({ ...config });
  const anchor_i = config_entries.findIndex(([key]) => key === anchor_key);
  if (anchor_i !== -1) {
    if (merge_object && Object.keys(merge_object).length > 0) {
      const entries = Object.entries(merge_object);
      config_entries.splice(anchor_i + 1, 0, ...entries);
    }
  }
  return Object.fromEntries(config_entries);
}
