import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL_MS = 60_000;

/**
 * The browser only re-checks a service worker for updates on navigation, and at most once
 * every ~24h — far too infrequent for an installed PWA that's "resumed" from the home
 * screen instead of freshly navigated to. Poll manually so a new deploy is detected (and,
 * since registerType is 'autoUpdate', applied + reloaded automatically) within a minute
 * instead of requiring the user to fully close and reopen the app.
 */
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    setInterval(() => {
      registration.update().catch(() => {
        // Offline or otherwise unreachable — the next interval will retry.
      });
    }, UPDATE_CHECK_INTERVAL_MS);
  },
});
