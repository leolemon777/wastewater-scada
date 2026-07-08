import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so production builds work behind any static host / subpath.
  base: './',
  build: {
    // The three.js + postprocessing vendor bundles are large by nature; split them into
    // their own cacheable chunks and raise the warning ceiling so the build stays quiet.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // Split heavy, stable vendor libs into separate cacheable chunks. Keeps the
        // initial app shell small while the 3D scene loads on demand (see SCADAScene
        // lazy-loading in App.tsx). Function form routes each module to a named chunk.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three/fiber') || id.includes('@react-three/drei')) {
              return 'three-vendor';
            }
            if (id.includes('@react-three/postprocessing') || id.includes('postprocessing')) {
              return 'postprocessing-vendor';
            }
            if (id.includes('react') || id.includes('scheduler')) {
              return 'react-vendor';
            }
            return 'vendor';
          }
          return undefined;
        },
      },
    },
  },
})
