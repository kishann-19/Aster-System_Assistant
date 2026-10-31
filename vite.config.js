import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {devBackend} from './scripts/dev-backend.mjs';
export default defineConfig({ plugins:[react(),devBackend()], base:'./', server:{port:5173,strictPort:true}, build:{chunkSizeWarningLimit:1800} });
