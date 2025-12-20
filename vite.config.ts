
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// At build time (on Render/Vercel), we capture the environment variable.
// We check for both 'API_KEY' and 'GEMINI_API_KEY' to prevent common naming errors.
const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';

export default defineConfig({
  plugins: [react()],
  define: {
    // This replaces 'process.env.API_KEY' in the code with the actual string value during the build process.
    'process.env.API_KEY': JSON.stringify(apiKey)
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  preview: {
    allowedHosts: ['echospot.onrender.com', '.onrender.com']
  }
});
