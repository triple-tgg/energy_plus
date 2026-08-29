import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || '1.0.0'),
        __GIT_SHA__: JSON.stringify(process.env.VITE_GIT_SHA || ''),
    },
    resolve: {
        alias: {
            '@': new URL('./src', import.meta.url).pathname,
        },
    },
    server: {
        port: 5175,
        proxy: {
            '/api': {
                target: 'http://localhost:3003',
                changeOrigin: true,
            },
        },
    },
});
