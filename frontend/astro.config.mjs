import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
    server: {
        host: true,
        port: 4321
    },
    vite: {
        // Dev-server only. In production the site is built to static files and
        // served by nginx, which proxies /api to the backend (see frontend/nginx.conf).
        server: {
            proxy: {
                '/api': 'http://localhost:3344'
            }
        }
    },
    devToolbar: {
        enabled: false,
    },
    integrations: [tailwind()],
});
