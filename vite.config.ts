import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Charge aussi les variables sans préfixe VITE_ : elles ne partent jamais dans le bundle.
  const env = loadEnv(mode, '.', '');
  const hassUrl = env.HASS_URL === '' || env.HASS_URL === undefined ? 'http://192.168.1.51:8123' : env.HASS_URL;
  const hassToken = env.HASS_TOKEN;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        /*
         * Le jeton d'accès Home Assistant reste côté serveur de dev : il est injecté
         * dans la requête proxifiée. Le navigateur appelle /ha/... en same-origin,
         * donc ni CORS ni secret dans le bundle.
         */
        '/ha': {
          target: hassUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/ha/, ''),
          headers:
            hassToken === undefined || hassToken === ''
              ? {}
              : { Authorization: `Bearer ${hassToken}` },
        },
      },
    },
  };
});
