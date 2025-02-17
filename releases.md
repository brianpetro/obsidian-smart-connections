# Release Notes

## v2.5

### v2.5.0
- Added a new method to access early-release plugins.
- Fixed an issue where incomplete embeddings were not completed after reloading collections from Settings in Smart Connections.
- Implemented an inline confirm button for 'Clear All' to remove the system dialog prompt.
- Resolved a periodic freeze in the Smart Connections interface by disposing of the pipeline in the transformers embed model adapter.
- Added a 'Copy link' option for the ChatGPT item view.
- Moved the main Connections component implementation into main for a clear example of creating custom components.
- Updated Connections UX to only display either sources or blocks (not both) for a cleaner, more focused view.
- Introduced an initial process for installing Smart-plugins through OAuth in Smart Connections.
  - Supporters can download early-release plugins after signing in.
  - Uses the same local storage as existing Smart-plugins for consistent authentication.
- Replaced 'Download early-release' with a 'Sign in' button that, when authenticated, becomes 'Open Smart Plugins' and links to the Smart Plugins settings tab.
- Implemented new integration tests and updated documentation at:
  https://docs.smartconnections.app/Smart-Connections/