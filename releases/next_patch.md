#### Faster, more predictable Connections

Connections results are more responsive, and Connections now keeps its own scoring configuration instead of falling back to Lookup settings when both products use the same scoring method.

Connected tools can choose Sources or Blocks, cap the number of results, and apply filters. Those requests now follow the same Connections behavior as the interface, making results more consistent wherever you request them.

Dragging Smart items into Connections is also more reliable.

#### Full release notes

- Improved Connections-results performance.
- Improved drag-and-drop recognition of Smart items and their identities, including the Connections drag issue reported in #1367.
- Connections requests now accept a result limit, a Sources or Blocks selection, and filters.
- Connections now applies its own scoring settings to each request, so Lookup settings do not change Connections ranking when both products use the same scoring method.
- Improved consistency between Connections shown in the interface and Connections requested through connected tools by sharing more of the same retrieval logic.
- Clarified when and how to use the `smart_connections_list` tool.


#### Improved Connections display

- Connections graphs can now be shown or hidden independently from connection results.
- Renamed the existing graph to "2D similarity map" in preparation for additional graph styles.
- Improved graph styling so pinned and hidden connections are easier to distinguish.
- Simplified Connections display settings and clarified the "Show formatted text" option.
- Improved the underlying Connections display architecture for more consistent behavior across views, code blocks, and note footers.

---

#### Connections tool selector

- The `smart_connections_list` tool now requires `key` instead of `to` and returns its root identity as `key`. Update saved requests and clients; the legacy selector is no longer accepted. Ranked retrieval, filters, feedback, and optional content are unchanged.
