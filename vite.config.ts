import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages base path. The repo is deployed at /Pilot_Logbook/ by default.
// Override with VITE_BASE=/ at build time for root deployments.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE ?? '/Pilot_Logbook/';

  return {
    base,
    plugins: [
      react(),
      // Self-destroying mode: emits an sw.js that unregisters any previously
      // registered service worker and clears its caches, then removes itself.
      // Rescues browsers that were stuck on a stale precache from an earlier
      // Pages deploy. Can be switched back to a normal PWA once the fleet
      // is known to be clean.
      VitePWA({
        registerType: 'autoUpdate',
        selfDestroying: true,
        includeAssets: ['favicon.svg', 'icon.svg'],
        manifest: false
      })
    ]
  };
});
