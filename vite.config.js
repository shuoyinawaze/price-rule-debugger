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
      // Proxy our custom API routes to Express server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  }
});