import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Charge aussi les variables sans préfixe VITE_ : elles ne partent jamais dans le bundle.
  const env = loadEnv(mode, '.', '');
  const hassUrl = env.HASS_URL === '' || env.HASS_URL === undefined ? 'http://192.168.1.51:8123' : env.HASS_URL;
  const hassToken = env.HASS_TOKEN;

  /*
   * Le jeton d'accès Home Assistant reste côté serveur : il est injecté dans la requête
   * proxifiée. Le navigateur appelle /ha/... en same-origin, donc ni CORS ni secret dans
   * le bundle. Le même objet sert au serveur de développement et à la prévisualisation
   * (`vite preview` sert `dist`, et sans ce proxy les appels `/ha` tomberaient en 404
   * dans la version servie au téléphone).
   */
  const haProxy = {
    '/ha': {
      target: hassUrl,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(/^\/ha/, ''),
      headers:
        hassToken === undefined || hassToken === ''
          ? {}
          : { Authorization: `Bearer ${hassToken}` },
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: haProxy,
    },
    /*
     * `npm run dev:mobile` (et `preview:mobile`) écoute sur toutes les interfaces, sur un
     * autre port : c'est ce que le téléphone ouvre, sur l'adresse LAN du poste.
     */
    preview: {
      proxy: haProxy,
    },
  };
});
