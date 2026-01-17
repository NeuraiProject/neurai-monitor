import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
    server: {
        host: true,
        port: 4321
    },
    vite: {
        server: {
            proxy: {
                '/api': 'http://backend:3344'
            }
        }
    },
    devToolbar: {
        enabled: false,
    },
    integrations: [tailwind()],
});
