import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const { version } = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '..', 'version.json'), 'utf-8')
);

export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || version),
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
