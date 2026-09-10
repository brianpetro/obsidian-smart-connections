### More consistent Connections across views and tools

Connections results are more responsive, and retrieval settings now stay with the Connections request that uses them. Ranking configuration no longer falls back to unrelated Lookup settings when both products use the same scoring method.

Connected tools can set a result limit, search Sources or Blocks, and apply filters. The Connections interface and tool actions also share more of the same retrieval behavior, while drag-and-drop recognizes Smart items more reliably.

![[connections-active-note-related-source-hero-editorial-16x9-dark-v4.8.1-r3.png]]

*Preview a related note alongside the note you're working on.*

### Full release notes

- Improved Connections-results performance.
- Improved drag-and-drop recognition of Smart items and their identities, including the Connections drag issue reported in #1367.
- Connections requests now accept a result limit, a Sources or Blocks selection, and filters.
- Connections now applies its own scoring settings to each request, so Lookup settings do not change Connections ranking when both products use the same scoring method.
- Improved consistency between Connections shown in the interface and Connections requested through connected tools by sharing more of the same retrieval logic.
- Clarified when and how to use the `smart_connections_list` tool.
