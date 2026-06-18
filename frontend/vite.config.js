import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Vite Frontend Compiler Configuration
 * 
 * We mount both the React Fast Refresh compiler plugin and the official
 * Tailwind CSS v4 CSS parser engine.
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 5173,
    // Allows access across docker containers or local networks
    host: true,
  },
});
