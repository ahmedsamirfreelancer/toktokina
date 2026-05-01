import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'logo-192.png', 'logo-512.png'],
            manifest: {
                name: 'توكتوكينا - اطلب توكتوك',
                short_name: 'توكتوكينا',
                description: 'اطلب توكتوك في ثواني',
                theme_color: '#10b981',
                background_color: '#ffffff',
                display: 'standalone',
                orientation: 'portrait',
                start_url: '/',
                dir: 'rtl',
                lang: 'ar',
                icons: [
                    { src: 'logo-192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
                ]
            }
        })
    ],
    server: {
        proxy: { '/api': 'http://localhost:3500', '/socket.io': { target: 'http://localhost:3500', ws: true } }
    }
});
