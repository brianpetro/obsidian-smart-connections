/** Target-local user attribution, not preference, confidence, or authorization. */
export const connection_feedback_schema = {
  type: 'object',
  properties: {
    state: { type: 'string', enum: ['pinned', 'hidden'] },
  },
  required: ['state'],
  additionalProperties: false,
};
