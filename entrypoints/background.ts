// Background service worker entry.
// Message handlers (TRANSLATE_CUES / GET_SETTINGS) are registered by the
// translation orchestrator, wired up in a later task.
export default defineBackground(() => {
  // registerHandlers() — added when src/background/orchestrator.ts lands.
});
