import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the booking debugger application.
// This config enables the React plugin and sets the development
// server port. When the user runs `npm run dev` the app will be
// available on http://localhost:5173 by default.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://internalapi.novasol.com',
        changeOrigin: true,
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/saleability': {
        target: 'https://saleability-api.apex.awaze.com',
        changeOrigin: true,
        secure: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('saleability proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Saleability Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Saleability Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  }
});