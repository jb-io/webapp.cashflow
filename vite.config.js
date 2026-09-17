import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative Basis, damit der Build auch aus einem Unterverzeichnis heraus läuft;
// die Navigation selbst geht ohnehin über Hash-Routen.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 3000 },
  preview: { port: 3000 },
});
