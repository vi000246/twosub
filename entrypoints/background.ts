import { registerHandlers } from '../src/background/orchestrator';

// Background service worker entry. Registers TRANSLATE_CUES / GET_SETTINGS handlers.
export default defineBackground(() => {
  registerHandlers();
});
