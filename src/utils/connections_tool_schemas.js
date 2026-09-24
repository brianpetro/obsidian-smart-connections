import { collection_tool_action_schemas } from 'obsidian-smart-env/src/utils/collection_tool_action_schemas.js';
import { connections_filter_keys } from './copy_connections_filter.js';

/** Connections retrieval accepts only canonical filter operands. */
export const connections_tool_action_schemas = {
  ...collection_tool_action_schemas,
  filter: {
    ...collection_tool_action_schemas.filter,
    properties: Object.fromEntries(connections_filter_keys.map((key) => [
      key, collection_tool_action_schemas.filter.properties[key],
    ])),
  },
};

/** Target-local user attribution, not preference, confidence, or authorization. */
export const connection_feedback_schema = {
  type: 'object',
  properties: {
    state: { type: 'string', enum: ['pinned', 'hidden'] },
  },
  required: ['state'],
  additionalProperties: false,
};
