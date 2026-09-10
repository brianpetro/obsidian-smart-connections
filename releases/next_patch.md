### Faster, more predictable Connections

Connections results are more responsive, and Connections now keeps its own scoring configuration instead of falling back to Lookup settings when both products use the same scoring method.

Connected tools can choose Sources or Blocks, cap the number of results, and apply filters. Those requests now follow the same Connections behavior as the interface, making results more consistent wherever you request them.

Dragging Smart items into Connections is also more reliable.

### Full release notes

- Improved Connections-results performance.
- Improved drag-and-drop recognition of Smart items and their identities, including the Connections drag issue reported in #1367.
- Connections requests now accept a result limit, a Sources or Blocks selection, and filters.
- Connections now applies its own scoring settings to each request, so Lookup settings do not change Connections ranking when both products use the same scoring method.
- Improved consistency between Connections shown in the interface and Connections requested through connected tools by sharing more of the same retrieval logic.
- Clarified when and how to use the `smart_connections_list` tool.
